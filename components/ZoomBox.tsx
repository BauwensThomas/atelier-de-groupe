"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export const DOC_ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const A4_WIDTH = (210 / 25.4) * 96; // largeur d'une page A4 en pixels

// Agrandit (ou réduit) la page comme une loupe. La page garde sa mise en page réelle (sauts de page compris) :
// seul l'affichage est mis à l'échelle, et la place occupée suit pour pouvoir défiler.
export function ZoomBox({ zoom: wanted, children }: { zoom: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const parent = outer.current?.parentElement;
    const content = inner.current;
    if (!parent || !content) return;
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(parent);
      setAvailable(parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
      setHeight(content.offsetHeight);
    });
    observer.observe(parent);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Sur téléphone (pas de pages A4), pas de zoom : on garde le zoom du téléphone lui-même.
  const zoom = available && available < 600 ? 1 : wanted;
  // Même largeur de page qu'à 100 % (la place disponible, sans dépasser le format A4).
  const width = available ? Math.min(available, A4_WIDTH) : undefined;
  return (
    <div ref={outer} className="zoom-box shrink-0" style={width ? { width: width * zoom, height: height * zoom } : undefined}>
      <div ref={inner} className="zoom-inner" style={{ width, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}
