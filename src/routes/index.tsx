import { createFileRoute } from "@tanstack/react-router";
import { ImageToVector } from "@/features/vectorizer/ImageToVector";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Vectorizer Key — Imagem para SVG/PDF" },
      {
        name: "description",
        content:
          "Vectorizer Key: converta imagens raster (PNG, JPG, WEBP) em vetores SVG ou PDF de alta qualidade.",
      },
    ],
  }),
});

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <ImageToVector />
    </main>
  );
}
