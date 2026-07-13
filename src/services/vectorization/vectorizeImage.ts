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
  let { width, height } = img;
  
  if (Math.max(width, height) > opts.maxSize) {
    const scale = opts.maxSize / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, 0, 0, width, height);

  return ctx.getImageData(0, 0, width, height);
}

// Extrator de Cores Puras (Clusterização por Média Real)
export async function analyzeColorCount(file: File): Promise<string[]> {
  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);
  
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return ["#000000"]; 

  const maxDim = 300;
  let width = img.width, height = img.height;
  if (Math.max(width, height) > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
  }
  canvas.width = width; canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;

  const colorMap = new Map<string, {count: number, r: number, g: number, b: number}>();
  let totalOpaquePixels = 0;

  for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 50) continue; 
      totalOpaquePixels++;
      
      const br = Math.round(data[i] / 24) * 24;
      const bg = Math.round(data[i+1] / 24) * 24;
      const bb = Math.round(data[i+2] / 24) * 24;
      const key = `${br},${bg},${bb}`;
      
      if (!colorMap.has(key)) {
          colorMap.set(key, {count: 0, r: 0, g: 0, b: 0});
      }
      const bObj = colorMap.get(key);
      bObj.count++;
      bObj.r += data[i];
      bObj.g += data[i+1];
      bObj.b += data[i+2];
  }

  const validColors: {hex: string, count: number}[] = [];
  for (const val of colorMap.values()) {
      if (val.count / totalOpaquePixels > 0.005) { // 0.5% Threshold
          // Resgata o HEX exato da imagem, sem gerar "cores lamas"
          const avgR = Math.round(val.r / val.count);
          const avgG = Math.round(val.g / val.count);
          const avgB = Math.round(val.b / val.count);
          const hex = `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`;
          validColors.push({hex, count: val.count});
      }
  }

  validColors.sort((a, b) => b.count - a.count);
  if (validColors.length === 0) return ["#000000"];
  return validColors.map(v => v.hex);
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
    ltres: opts.ltres,
    qtres: opts.qtres,
    pathomit: opts.pathomit,
    roundcoords: opts.roundcoords || 2,
    linefilter: opts.linefilter !== undefined ? opts.linefilter : true,
    rightangleenhance: opts.rightangleenhance !== undefined ? opts.rightangleenhance : false,
    blurradius: opts.blurradius || 0,
    blurdelta: opts.blurradius ? 20 : 0,
    
    // O SEGREDO: O motor agora SÓ pode usar as cores exatas passadas pelo usuário/auto-detect
    pal: strictPalette,
    
    layering: true, // Z-Index nativo restaurado (Fim dos vazamentos)
    scale: 1,
    viewbox: true,
    desc: false
  };

  const svg = ImageTracer.imagedataToSVG(imageData, tracerOptions);
  
  const durationMs = performance.now() - start;
  return { svg, width: imageData.width, height: imageData.height, durationMs };
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
