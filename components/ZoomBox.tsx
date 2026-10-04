"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export const DOC_ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const A4_WIDTH = (210 / 25.4) * 96; // largeur d'une page A4 en pixels

// Agrandit (ou réduit) la page comme une loupe. La page garde sa mise en page réelle (sauts de page compris) :
// seul l'affichage est mis à l'échelle, et la place occupée suit pour pouvoir défiler.
// À 100 %, la page est affichée telle quelle, sans cadre ni calcul (aucun mouvement pendant la frappe).
// Les deux affichages ont la même structure : passer de l'un à l'autre ne recrée pas l'éditeur.
export function ZoomBox({ zoom: wanted, children }: { zoom: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const [height, setHeight] = useState(0);
  // Sur téléphone (pas de pages A4), pas de zoom : on garde le zoom du téléphone lui-même.
  const zoom = available && available < 600 ? 1 : wanted;
  const scaled = zoom !== 1;

  // Place disponible (toujours suivie, pour savoir si on est sur téléphone).
  useEffect(() => {
    const parent = outer.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(parent);
      setAvailable(parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  // Hauteur réelle de la page, seulement quand elle est zoomée.
  useEffect(() => {
    const content = inner.current;
    if (!scaled || !content) return;
    const observer = new ResizeObserver(() => setHeight(content.offsetHeight));
    observer.observe(content);
    return () => observer.disconnect();
  }, [scaled]);

  // Même largeur de page qu'à 100 % (la place disponible, sans dépasser le format A4).
  const width = available ? Math.min(available, A4_WIDTH) : undefined;
  return (
    <div
      ref={outer}
      className={scaled ? "zoom-box shrink-0" : "zoom-box w-full max-w-[210mm]"}
      style={scaled && width ? { width: width * zoom, height: height * zoom } : undefined}
    >
      <div
        ref={inner}
        className="zoom-inner"
        style={scaled ? { width, transform: `scale(${zoom})`, transformOrigin: "top left" } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
