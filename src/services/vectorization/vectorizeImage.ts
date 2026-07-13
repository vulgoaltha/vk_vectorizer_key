// @ts-nocheck
import ImageTracer from "imagetracerjs";

export interface VectorizeOptions {
  numberofcolors: number;
  ltres: number;
  qtres: number;
  pathomit: number;
  blurradius: number;
  grayscale: boolean;
  maxSize: number;
  rightangleenhance: boolean;
  roundcoords: number;
  linefilter: boolean;
  colorquantcycles: number;
  mincolorratio: number;
  monochrome?: boolean;
  customColorCount?: number;
}

export const DEFAULT_OPTIONS: VectorizeOptions = {
  numberofcolors: 24, 
  ltres: 1,
  qtres: 1,
  pathomit: 2,
  blurradius: 0,
  grayscale: false,
  maxSize: 2048,
  rightangleenhance: false,
  roundcoords: 1,
  linefilter: true,
  colorquantcycles: 5,
  mincolorratio: 0.01,
  monochrome: false,
  customColorCount: undefined,
};

export const PRESETS: Record<string, Partial<VectorizeOptions>> = {
  sharp: { ltres: 1, qtres: 1, pathomit: 0, blurradius: 0 },
  balanced: { ltres: 1.5, qtres: 1.5, pathomit: 4, blurradius: 0 },
  smooth: { ltres: 3, qtres: 3, pathomit: 8, blurradius: 1 },
  ultra: { ltres: 5, qtres: 5, pathomit: 16, blurradius: 2 },
};

export interface VectorizeResult {
  svg: string;
  width: number;
  height: number;
  durationMs: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}



async function preprocess(file: File, opts: VectorizeOptions): Promise<ImageData> {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  let targetW = img.width;
  let targetH = img.height;
  if (Math.max(targetW, targetH) > opts.maxSize) {
    const scale = opts.maxSize / Math.max(targetW, targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  // Super-sample adaptativo: imagens pequenas ganham mais suavização
  const SUPERSAMPLE = Math.max(1, Math.min(3, Math.round(1500 / Math.max(targetW, targetH))));

  const bigCanvas = document.createElement("canvas");
  bigCanvas.width = targetW * SUPERSAMPLE;
  bigCanvas.height = targetH * SUPERSAMPLE;
  const bigCtx = bigCanvas.getContext("2d")!;
  bigCtx.imageSmoothingEnabled = true;
  bigCtx.imageSmoothingQuality = "high";
  bigCtx.drawImage(img, 0, 0, bigCanvas.width, bigCanvas.height);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bigCanvas, 0, 0, targetW, targetH);

  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  return imageData;
}

function mergeSimilarColors(
  colors: { hex: string; count: number }[],
  threshold = 30
): string[] {
  const hexToRgb = (h: string): [number, number, number] => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  type Bucket = { r: number; g: number; b: number; count: number };
  const buckets: Bucket[] = [];

  for (const c of colors) {
    const [r, g, b] = hexToRgb(c.hex);
    let matched = false;
    for (const bucket of buckets) {
      const avgR = bucket.r / bucket.count;
      const avgG = bucket.g / bucket.count;
      const avgB = bucket.b / bucket.count;
      const dist = Math.abs(avgR - r) + Math.abs(avgG - g) + Math.abs(avgB - b);
      if (dist <= threshold) {
        bucket.r += r * c.count;
        bucket.g += g * c.count;
        bucket.b += b * c.count;
        bucket.count += c.count;
        matched = true;
        break;
      }
    }
    if (!matched) {
      buckets.push({ r: r * c.count, g: g * c.count, b: b * c.count, count: c.count });
    }
  }

  buckets.sort((a, b) => b.count - a.count);
  return buckets.map((b) => {
    const r = Math.round(b.r / b.count);
    const g = Math.round(b.g / b.count);
    const bb = Math.round(b.b / b.count);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`;
  });
}

// Extrator de Cores Puras (Clusterização por Média Real)
export async function analyzeColorCount(file: File): Promise<string[]> {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return ["#000000"];

  const maxDim = 400;
  let width = img.width, height = img.height;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  canvas.width = width; canvas.height = height;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;

  const BUCKET = 12;
  const colorMap = new Map<string, { count: number; r: number; g: number; b: number }>();
  let totalStablePixels = 0;

  const px = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i+1], data[i+2], data[i+3]];
  };

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      if (data[i+3] < 200) continue;

      const [r, g, b] = [data[i], data[i+1], data[i+2]];
      let isEdge = false;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const [nr, ng, nb, na] = px(x + dx, y + dy);
        if (na < 200 || Math.abs(nr - r) + Math.abs(ng - g) + Math.abs(nb - b) > 45) {
          isEdge = true;
          break;
        }
      }
      if (isEdge) continue;

      totalStablePixels++;
      const br = Math.round(r / BUCKET) * BUCKET;
      const bg = Math.round(g / BUCKET) * BUCKET;
      const bb = Math.round(b / BUCKET) * BUCKET;
      const key = `${br},${bg},${bb}`;
      if (!colorMap.has(key)) colorMap.set(key, { count: 0, r: 0, g: 0, b: 0 });
      const o = colorMap.get(key)!;
      o.count++; o.r += r; o.g += g; o.b += b;
    }
  }

  const validColors: { hex: string; count: number }[] = [];
  for (const val of colorMap.values()) {
    if (val.count / totalStablePixels > 0.004) {
      const hex = `#${Math.round(val.r/val.count).toString(16).padStart(2,'0')}${Math.round(val.g/val.count).toString(16).padStart(2,'0')}${Math.round(val.b/val.count).toString(16).padStart(2,'0')}`;
      validColors.push({ hex, count: val.count });
    }
  }
  validColors.sort((a, b) => b.count - a.count);
  const merged = mergeSimilarColors(validColors, 30);
  return merged.length ? merged : ["#000000"];
}

function buildLabelMap(
  imageData: ImageData,
  palette: { r: number; g: number; b: number; a: number }[]
): Int32Array {
  const { width, height, data } = imageData;
  const labels = new Int32Array(width * height);
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 30) { labels[p] = -1; continue; }
    let best = 0, bestDist = Infinity;
    for (let k = 0; k < palette.length; k++) {
      const c = palette[k];
      if (c.a === 0) continue;
      const d = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
      if (d < bestDist) { bestDist = d; best = k; }
    }
    labels[p] = best;
  }
  return labels;
}

function maskFromLabel(labels: Int32Array, colorIndex: number): Uint8Array {
  const out = new Uint8Array(labels.length);
  for (let i = 0; i < labels.length; i++) out[i] = labels[i] === colorIndex ? 1 : 0;
  return out;
}

const NEIGHBORS_4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function erode(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask[i] === 0) { out[i] = 0; continue; }
      let keep = 1;
      for (const [dx, dy] of NEIGHBORS_4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || mask[ny * width + nx] === 0) {
          keep = 0; break;
        }
      }
      out[i] = keep;
    }
  }
  return out;
}

function dilate(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (mask[i] === 1) { out[i] = 1; continue; }
      let fill = 0;
      for (const [dx, dy] of NEIGHBORS_4) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[ny * width + nx] === 1) {
          fill = 1; break;
        }
      }
      out[i] = fill;
    }
  }
  return out;
}

// Abertura (remove ilhas/franjas pequenas) + Fechamento (fecha mordidas/buracos)
function cleanMask(mask: Uint8Array, width: number, height: number): Uint8Array {
  let m = erode(mask, width, height);
  m = dilate(m, width, height);
  m = dilate(m, width, height);
  m = erode(m, width, height);
  return m;
}

function compositeCleanedLayers(
  imageData: ImageData,
  palette: { r: number; g: number; b: number; a: number }[]
): ImageData {
  const { width, height } = imageData;
  const labels = buildLabelMap(imageData, palette);

  const counts = new Array(palette.length).fill(0);
  for (const l of labels) if (l >= 0) counts[l]++;

  const order = palette
    .map((_, idx) => idx)
    .filter((idx) => palette[idx].a !== 0)
    .sort((a, b) => counts[b] - counts[a]); // maior área primeiro (fundo), menor por cima (detalhes)

  const finalLabel = new Int32Array(width * height).fill(-1);
  for (const colorIndex of order) {
    const rawMask = maskFromLabel(labels, colorIndex);
    const cleaned = cleanMask(rawMask, width, height);
    for (let i = 0; i < cleaned.length; i++) {
      if (cleaned[i] === 1) finalLabel[i] = colorIndex;
    }
  }

  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < finalLabel.length; i++) {
    const l = finalLabel[i];
    const o = i * 4;
    if (l === -1) { out[o + 3] = 0; continue; }
    const c = palette[l];
    out[o] = c.r; out[o + 1] = c.g; out[o + 2] = c.b; out[o + 3] = 255;
  }
  return new ImageData(out, width, height);
}

export async function vectorizeImage(
  file: File,
  options: Partial<VectorizeOptions> = {},
): Promise<VectorizeResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const start = performance.now();

  const imageData = await preprocess(file, opts);
  
  // 1. Extração Dinâmica do Front-End
  const detectedColors = await analyzeColorCount(file);
  const limit = opts.monochrome ? 2 : (opts.customColorCount || opts.numberofcolors || 16);
  const activeHex = opts.monochrome ? ["#000000", "#ffffff"] : detectedColors.slice(0, limit);
  
  // 2. Construção da Paleta Estrita (A Blindagem Mestra)
  const strictPalette = activeHex.map(hex => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
    a: 255
  }));
  strictPalette.push({ r: 0, g: 0, b: 0, a: 0 }); // Transparência

  // 3. Configuração Nativa do ImageTracer
  const tracerOptions = {
    ltres: Math.max(opts.ltres, 1.5),
    qtres: Math.max(opts.qtres, 2.5),
    colorquantcycles: 8,
    pathomit: Math.max(opts.pathomit, 15),
    roundcoords: opts.roundcoords || 2,
    linefilter: true,
    rightangleenhance: true,
    blurradius: 0,
    blurdelta: 0,
    pal: strictPalette,
    layering: true,
    strokewidth: 1.25,
    scale: 1,
    viewbox: true,
    desc: false,
  };

  const cleanedImageData = compositeCleanedLayers(imageData, strictPalette);
  const svg = ImageTracer.imagedataToSVG(cleanedImageData, tracerOptions);
  const backgroundHex = activeHex[0] ?? "#ffffff";
  const finalSvg = injectBackgroundRect(svg, backgroundHex, imageData.width, imageData.height);
  
  const durationMs = performance.now() - start;
  return { svg: finalSvg, width: imageData.width, height: imageData.height, durationMs };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function svgToPdfBlob(
  svg: string,
  width: number,
  height: number,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { svg2pdf } = await import("svg2pdf.js");
  const pdf = new jsPDF({
    orientation: width >= height ? "landscape" : "portrait",
    unit: "pt",
    format: [width, height],
  });
  const container = document.createElement("div");
  container.innerHTML = svg.trim();
  const svgEl = container.querySelector("svg");
  if (!svgEl) throw new Error("Invalid SVG");
  await svg2pdf(svgEl as unknown as Element, pdf, { width, height });
  return pdf.output("blob");
}

function injectBackgroundRect(svg: string, bgHex: string, width: number, height: number): string {
  const rect = `<rect x="0" y="0" width="${width}" height="${height}" fill="${bgHex}"/>`;
  return svg.replace(/(<svg[^>]*>)/, `$1${rect}`);
}
