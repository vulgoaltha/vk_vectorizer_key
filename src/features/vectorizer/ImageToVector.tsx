// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Download, Loader2, Sparkles, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  vectorizeImage,
  svgToPdfBlob,
  downloadBlob,
  generateDownloadFileName,
  DEFAULT_OPTIONS,
  PRESETS,
  analyzeColorCount,
  type VectorizeOptions,
  type VectorizeResult,
} from "@/services/vectorization/vectorizeImage";

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

export function ImageToVector() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preset, setPreset] = useState<string>("smooth");
  const [options, setOptions] = useState<VectorizeOptions>({
    ...DEFAULT_OPTIONS,
    ...PRESETS.smooth,
  });
  const [result, setResult] = useState<VectorizeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    if (!ACCEPTED.includes(f.type)) {
      setError("Formato não suportado. Use PNG, JPG ou WEBP.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("Arquivo muito grande (máx 10MB).");
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);

    analyzeColorCount(f).then((detectedColors) => {
      console.log(`[Auto-Detect] ${detectedColors.length} cores identificadas na imagem.`);
      setOptions(prev => ({
        ...prev,
        customColorCount: detectedColors.length,
        numberofcolors: detectedColors.length
      }));
    }).catch(err => console.error("Falha na auto-detecção de cores", err));
  }, []);

  const runVectorize = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await vectorizeImage(file, options);
      console.log("[DEBUG] resultado:", r);
      console.log("[DEBUG] svg length:", r?.svg?.length);
      console.log("[DEBUG] svg preview:", r?.svg?.substring(0, 200));
      setResult(r);
    } catch (e) {
      console.error("[Vectorizer] Error", e);
      setError(e instanceof Error ? e.message : "Falha na vetorização");
    } finally {
      setBusy(false);
    }
  }, [file, options]);

  // Auto-vectorize when a file is loaded or options change (debounced)
  useEffect(() => {
    if (!file) return;
    const t = setTimeout(() => {
      runVectorize();
    }, 350);
    return () => clearTimeout(t);
  }, [file, options, runVectorize]);

  useEffect(() => {
    if (result?.svg) {
      const svgEls = document.querySelectorAll('.svg-preview-container svg');
      svgEls.forEach((svgEl) => {
        if (svgEl.getAttribute('width')) svgEl.setAttribute('width', '100%');
        if (svgEl.getAttribute('height')) svgEl.setAttribute('height', '100%');
        (svgEl as HTMLElement).style.maxWidth = '100%';
        (svgEl as HTMLElement).style.maxHeight = '100%';
      });
    }
  }, [result]);

  const downloadSvg = useCallback(() => {
    if (!result || !file) return;
    const blob = new Blob([result.svg], { type: "image/svg+xml" });
    downloadBlob(blob, generateDownloadFileName(file.name, "svg"));
  }, [result, file]);

  const downloadPdf = useCallback(async () => {
    if (!result || !file) return;
    try {
      setBusy(true);
      const blob = await svgToPdfBlob(result.svg, result.width, result.height);
      downloadBlob(blob, generateDownloadFileName(file.name, "pdf"));
    } catch (e) {
      console.error("[Vectorizer] PDF error", e);
      setError("Falha ao gerar PDF");
    } finally {
      setBusy(false);
    }
  }, [result, file]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 sm:p-6 lg:p-8">
      <header className="space-y-2 text-center">
        <div className="inline-flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-md">
            VK
          </div>
          <span className="text-lg font-semibold tracking-tight">Vectorizer Key</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Sparkles className="h-3 w-3" />
          Vectorizer Key
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Imagem → Vetor
        </h1>
        <p className="text-sm text-muted-foreground">
          Converta PNG, JPG ou WEBP em SVG/PDF vetorial de alta fidelidade.
        </p>
      </header>

      {!file && (
        <Card
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 border-dashed p-12 text-center transition-colors ${
            dragOver ? "border-primary bg-accent/40" : "hover:bg-accent/20"
          }`}
        >
          <div className="rounded-full bg-primary/10 p-4">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">Arraste uma imagem ou clique para enviar</p>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPG, WEBP · até 10MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </Card>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {file && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <PreviewCard label="Original">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Original"
                  className="h-full w-full object-contain"
                />
              )}
            </PreviewCard>
            <PreviewCard label="Vetorizado">
              {result?.svg ? (
                <div
                  className="svg-preview-container h-full w-full animate-in fade-in duration-500 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: result.svg }}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <ImageIcon className="h-8 w-8 opacity-40" />
                  <p className="text-xs">
                    {busy ? "Processando..." : "Clique em Gerar Vetor"}
                  </p>
                </div>
              )}
            </PreviewCard>
          </div>

          <Card className="space-y-5 p-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Qualidade (preset)</Label>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {(["sharp", "balanced", "smooth", "ultra"] as const).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={preset === p ? "default" : "outline"}
                    className="h-8 px-1 text-[10px] capitalize"
                    onClick={() => {
                      setPreset(p);
                      setOptions((o) => ({ ...o, ...PRESETS[p] }));
                    }}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Cores</Label>
                <span className="text-xs text-muted-foreground">
                  {options.numberofcolors}
                </span>
              </div>
              <Slider
                min={2}
                max={24}  // era 16
                step={1}
                value={[options.numberofcolors]}
                onValueChange={([v]) =>
                  setOptions((o) => ({ ...o, numberofcolors: v }))
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Suavidade de curvas</Label>
                <span className="text-xs text-muted-foreground">
                  {options.ltres.toFixed(1)}
                </span>
              </div>
              <Slider
                min={0.1}
                max={10}
                step={0.1}
                value={[options.ltres]}
                onValueChange={([v]) =>
                  setOptions((o) => ({ ...o, ltres: v, qtres: v }))
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Threshold (omitir paths)</Label>
                <span className="text-xs text-muted-foreground">
                  {options.pathomit}
                </span>
              </div>
              <Slider
                min={0}
                max={32}
                step={1}
                value={[options.pathomit]}
                onValueChange={([v]) =>
                  setOptions((o) => ({ ...o, pathomit: v }))
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Blur</Label>
                <span className="text-xs text-muted-foreground">
                  {options.blurradius}
                </span>
              </div>
              <Slider
                min={0}
                max={5}
                step={1}
                value={[options.blurradius]}
                onValueChange={([v]) =>
                  setOptions((o) => ({ ...o, blurradius: v }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="mono" className="text-xs">
                Monocromático (P&B)
              </Label>
              <Switch
                id="mono"
                checked={options.monochrome || false}
                onCheckedChange={(v) =>
                  setOptions((o) => ({ ...o, monochrome: v }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="gs" className="text-xs">
                Grayscale
              </Label>
              <Switch
                id="gs"
                checked={options.grayscale}
                onCheckedChange={(v) =>
                  setOptions((o) => ({ ...o, grayscale: v }))
                }
              />
            </div>

            <div className="space-y-2 pt-2">
              <Button
                onClick={runVectorize}
                disabled={busy}
                className="w-full"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processando
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Gerar Vetor
                  </>
                )}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={!result || busy}
                  onClick={downloadSvg}
                  className="w-full"
                >
                  <Download className="h-4 w-4" /> SVG
                </Button>
                <Button
                  variant="outline"
                  disabled={!result || busy}
                  onClick={downloadPdf}
                  className="w-full"
                >
                  <Download className="h-4 w-4" /> PDF
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
              >
                Trocar imagem
              </Button>
            </div>

            {result && (
              <p className="border-t border-border pt-3 text-center text-xs text-muted-foreground">
                {result.width}×{result.height}px ·{" "}
                {(result.durationMs / 1000).toFixed(2)}s
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function PreviewCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="relative aspect-square overflow-hidden border-border/50 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm transition-all hover:border-border">
      <div className="absolute left-3 top-3 z-10 rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
        {label}
      </div>
      <div
        className="h-full w-full"
        style={{
          backgroundImage:
            "linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(-45deg, hsl(var(--muted)) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(var(--muted)) 75%), linear-gradient(-45deg, transparent 75%, hsl(var(--muted)) 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
        }}
      >
        {children}
      </div>
    </Card>
  );
}
