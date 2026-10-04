"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export const DOC_ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const A4_WIDTH = (210 / 25.4) * 96; // largeur d'une page A4 en pixels
const PHONE = 500; // en dessous : téléphone, la page s'adapte à l'écran (pas de pages A4, même seuil que la pagination)

// Page toujours mise en page à la largeur A4, sur tous les écrans : le texte tombe aux mêmes endroits pour tout
// le monde (élèves et professeur), comme dans Word. Si la place manque (écran étroit, fichier ouvert à côté),
// la page est réduite comme une image au lieu d'être resserrée. Le zoom choisi s'ajoute à cette réduction.
// À l'échelle 1, la page est affichée telle quelle, sans cadre ni calcul (aucun mouvement pendant la frappe).
// Les deux affichages ont la même structure : passer de l'un à l'autre ne recrée pas l'éditeur.
export function ZoomBox({ zoom: wanted, children }: { zoom: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const [height, setHeight] = useState(0);

  const desktop = available >= PHONE;
  const fit = desktop && available < A4_WIDTH ? available / A4_WIDTH : 1;
  const scale = desktop ? Math.round(wanted * fit * 1000) / 1000 : 1;
  const scaled = scale !== 1;

  // Place disponible.
  useEffect(() => {
    const parent = outer.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(parent);
      setAvailable(Math.floor(parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)));
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  // Hauteur réelle de la page, seulement quand elle est mise à l'échelle.
  useEffect(() => {
    const content = inner.current;
    if (!scaled || !content) return;
    const observer = new ResizeObserver(() => setHeight(content.offsetHeight));
    observer.observe(content);
    return () => observer.disconnect();
  }, [scaled]);

  return (
    <div
      ref={outer}
      className={scaled ? "zoom-box shrink-0" : "zoom-box w-full max-w-[210mm]"}
      style={scaled ? { width: A4_WIDTH * scale, height: height * scale } : undefined}
    >
      <div
        ref={inner}
        className="zoom-inner"
        style={scaled ? { width: A4_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
