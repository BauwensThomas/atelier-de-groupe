"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Download, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { FILE_TYPES, formatSize, officeLimit, type FileKind } from "@/lib/file-types";
import { fileUrl, type ProjectFile } from "@/lib/files";
import { FileIcon } from "./FileIcon";

// Fichier ouvert à côté du document. Tout est affiché dans le navigateur : le fichier ne quitte pas le site.

type Props = { file: ProjectFile; onClose: () => void; onSwap: () => void };

function Message({ children }: { children: React.ReactNode }) {
  return <p className="p-6 text-center text-sm text-neutral-500">{children}</p>;
}

async function fetchBytes(file: ProjectFile): Promise<ArrayBuffer> {
  const res = await fetch(fileUrl(file));
  if (!res.ok) throw new Error(String(res.status));
  return res.arrayBuffer();
}

// Word : rendu par docx-preview (texte, titres, tableaux, images ; mise en page simplifiée).
function WordView({ file }: { file: ProjectFile }) {
  const body = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [bytes, { renderAsync }] = await Promise.all([fetchBytes(file), import("docx-preview")]);
        if (!alive || !body.current) return;
        body.current.innerHTML = "";
        await renderAsync(bytes, body.current, undefined, {
          inWrapper: true,
          ignoreLastRenderedPageBreak: true,
          breakPages: true,
          experimental: false,
        });
        // Liens du document : seulement http(s) et mailto, ouverts dans un nouvel onglet.
        body.current.querySelectorAll("a").forEach((a) => {
          const href = a.getAttribute("href") ?? "";
          if (!/^(https?:|mailto:|#)/i.test(href)) a.removeAttribute("href");
          else if (!href.startsWith("#")) {
            a.target = "_blank";
            a.rel = "noopener noreferrer";
          }
        });
        if (alive) setState("ok");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [file]);
  return (
    <>
      {state === "loading" && <Message>Ouverture du document…</Message>}
      {state === "error" && <Message>Aperçu impossible. Télécharge le fichier pour l&apos;ouvrir.</Message>}
      <div ref={body} className="docx-view" />
    </>
  );
}

type Grid = { name: string; rows: string[][]; cut: boolean };

/** 0 donne "A", 25 donne "Z", 26 donne "AA". */
function columnName(index: number): string {
  let name = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

// Image : ajustée à la largeur, avec zoom (boutons, ou Ctrl + molette) et déplacement en glissant.
function ImageView({ file }: { file: ProjectFile }) {
  const [zoom, setZoom] = useState<number | null>(null); // null : ajustée à la place disponible
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  // Largeur disponible, suivie quand la fenêtre change de taille.
  const [boxWidth, setBoxWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const fitScale = () => (natural && boxWidth ? Math.min(1, (boxWidth - 24) / natural.w) : 1);
  const scale = zoom ?? fitScale();
  const change = (factor: number) => setZoom(Math.min(8, Math.max(0.1, (zoom ?? fitScale()) * factor)));

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(8, Math.max(0.1, (z ?? fitScale()) * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, boxWidth]);

  const button = "flex h-7 w-7 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-neutral-200 bg-white px-2 py-1">
        <button type="button" className={button} onClick={() => change(1 / 1.25)} title="Dézoomer" aria-label="Dézoomer">
          <ZoomOut size={15} aria-hidden />
        </button>
        <span className="w-12 text-center text-xs text-neutral-600 tabular-nums">{Math.round(scale * 100)} %</span>
        <button type="button" className={button} onClick={() => change(1.25)} title="Zoomer" aria-label="Zoomer">
          <ZoomIn size={15} aria-hidden />
        </button>
        <button type="button" className={`${button} w-auto gap-1 px-2 text-xs`} onClick={() => setZoom(null)} title="Ajuster à la largeur">
          <Maximize2 size={13} aria-hidden />
          Ajuster
        </button>
        <button type="button" className={`${button} w-auto px-2 text-xs`} onClick={() => setZoom(1)} title="Taille réelle">
          100 %
        </button>
        <span className="ml-auto hidden text-[11px] text-neutral-400 sm:inline">Ctrl + molette pour zoomer</span>
      </div>
      <div
        ref={box}
        className={`min-h-0 flex-1 overflow-auto p-3 ${zoom ? "cursor-grab active:cursor-grabbing" : ""}`}
        onMouseDown={(e) => {
          if (!box.current || !zoom) return;
          drag.current = { x: e.clientX, y: e.clientY, left: box.current.scrollLeft, top: box.current.scrollTop };
        }}
        onMouseMove={(e) => {
          if (!drag.current || !box.current) return;
          box.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
          box.current.scrollTop = drag.current.top - (e.clientY - drag.current.y);
        }}
        onMouseUp={() => (drag.current = null)}
        onMouseLeave={() => (drag.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fileUrl(file)}
          alt={file.name}
          draggable={false}
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className="mx-auto max-w-none rounded shadow-sm select-none"
          style={natural ? { width: natural.w * scale, height: natural.h * scale } : { maxWidth: "100%" }}
        />
      </div>
    </div>
  );
}

// Excel, OpenDocument et CSV : chaque feuille de calcul en tableau.
function ExcelView({ file }: { file: ProjectFile }) {
  const [sheets, setSheets] = useState<Grid[] | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [bytes, XLSX] = await Promise.all([fetchBytes(file), import("xlsx")]);
        const book = XLSX.read(bytes, { type: "array" });
        const grids = book.SheetNames.map((name) => {
          const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[name], { header: 1, raw: false, defval: "" });
          return { name, rows: rows.slice(0, 1000).map((r) => r.slice(0, 60).map(String)), cut: rows.length > 1000 };
        });
        if (alive) setSheets(grids);
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [file]);
  if (error) return <Message>Aperçu impossible. Télécharge le fichier pour l&apos;ouvrir.</Message>;
  if (!sheets) return <Message>Ouverture du tableau…</Message>;
  const grid = sheets[active] ?? sheets[0];
  const width = Math.max(1, ...grid.rows.map((r) => r.length));
  return (
    <div className="flex min-h-0 flex-col">
      {sheets.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-neutral-200 bg-neutral-50 px-2 pt-1">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setActive(i)}
              className={`shrink-0 rounded-t px-2.5 py-1 text-xs ${i === active ? "bg-white font-medium ring-1 ring-neutral-200" : "text-neutral-600 hover:bg-white/70"}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-auto">
        <table className="border-collapse bg-white text-xs">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 border border-neutral-300 bg-neutral-100" />
              {Array.from({ length: width }, (_, c) => (
                <th key={c} className="sticky top-0 z-10 min-w-16 border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-normal text-neutral-500">
                  {columnName(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, r) => (
              <tr key={r}>
                <th className="sticky left-0 z-10 border border-neutral-300 bg-neutral-100 px-1.5 text-right font-normal text-neutral-500">{r + 1}</th>
                {Array.from({ length: width }, (_, c) => (
                  <td key={c} className="max-w-64 truncate border border-neutral-300 px-1.5 py-0.5" title={row[c] ?? ""}>
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {grid.cut && <Message>Seules les 1000 premières lignes sont affichées.</Message>}
        {grid.rows.length === 0 && <Message>Feuille vide.</Message>}
      </div>
    </div>
  );
}

type Slide = { n: number; texts: string[]; images: string[] };

// PowerPoint : texte et images de chaque diapositive (sans la mise en forme).
function PowerPointView({ file }: { file: ProjectFile }) {
  const [slides, setSlides] = useState<Slide[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    (async () => {
      try {
        const [bytes, { default: JSZip }] = await Promise.all([fetchBytes(file), import("jszip")]);
        const zip = await JSZip.loadAsync(bytes);
        const names = Object.keys(zip.files)
          .map((name) => name.match(/^ppt\/slides\/slide(\d+)\.xml$/))
          .filter((m): m is RegExpMatchArray => m !== null)
          .sort((a, b) => Number(a[1]) - Number(b[1]));
        const parser = new DOMParser();
        const list: Slide[] = [];
        for (const m of names) {
          const xml = parser.parseFromString(await zip.file(m[0])!.async("text"), "application/xml");
          const texts = Array.from(xml.getElementsByTagName("a:p"))
            .map((p) => Array.from(p.getElementsByTagName("a:t")).map((t) => t.textContent ?? "").join(""))
            .filter((t) => t.trim());
          // Images : liens de la diapositive vers ppt/media/...
          const relsFile = zip.file(`ppt/slides/_rels/slide${m[1]}.xml.rels`);
          const rels = new Map<string, string>();
          if (relsFile) {
            const relsXml = parser.parseFromString(await relsFile.async("text"), "application/xml");
            for (const rel of Array.from(relsXml.getElementsByTagName("Relationship"))) {
              rels.set(rel.getAttribute("Id") ?? "", rel.getAttribute("Target") ?? "");
            }
          }
          const images: string[] = [];
          for (const blip of Array.from(xml.getElementsByTagName("a:blip"))) {
            const target = rels.get(blip.getAttribute("r:embed") ?? "");
            const media = target ? zip.file(`ppt/${target.replace(/^\.\.\//, "")}`) : null;
            if (!media || !/\.(png|jpe?g|gif|webp)$/i.test(media.name)) continue;
            const url = URL.createObjectURL(await media.async("blob"));
            urls.push(url);
            images.push(url);
          }
          list.push({ n: Number(m[1]), texts, images });
        }
        if (alive) setSlides(list);
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [file]);
  if (error) return <Message>Aperçu impossible. Télécharge le fichier pour l&apos;ouvrir.</Message>;
  if (!slides) return <Message>Ouverture de la présentation…</Message>;
  if (!slides.length) return <Message>Aucune diapositive.</Message>;
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-[11px] text-neutral-500">Aperçu simplifié : le texte et les images, sans la mise en forme.</p>
      {slides.map((s) => (
        <section key={s.n} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Diapositive {s.n}</p>
          {s.texts.map((t, i) => (
            <p key={i} className={i === 0 ? "mb-1 text-base font-semibold" : "text-sm"}>
              {t}
            </p>
          ))}
          {s.images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {s.images.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" className="max-h-48 max-w-full rounded ring-1 ring-neutral-200" />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function TextView({ file }: { file: ProjectFile }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetchBytes(file)
      .then((b) => alive && setText(new TextDecoder().decode(b).slice(0, 500_000)))
      .catch(() => alive && setText(""));
    return () => {
      alive = false;
    };
  }, [file]);
  if (text === null) return <Message>Ouverture…</Message>;
  return <pre className="p-4 text-xs whitespace-pre-wrap wrap-break-word">{text}</pre>;
}

// Visionneuse Microsoft : affichage identique à Office. Le fichier lui est donné par un lien secret de 10 minutes,
// recréé à chaque ouverture.
function MicrosoftView({ file }: { file: ProjectFile }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/files/viewer-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file.path }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { url?: string }) => {
        if (!alive) return;
        if (data.url) setSrc(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(data.url)}`);
        else setError(true);
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [file]);
  if (error) return <Message>Affichage impossible pour le moment. Essaie l&apos;aperçu simplifié, ou télécharge le fichier.</Message>;
  if (!src) return <Message>Ouverture…</Message>;
  return <iframe src={src} title={file.name} className="h-full min-h-[70vh] w-full border-0 bg-white" />;
}

/** Microsoft ne peut pas lire un fichier sur l'ordinateur de développement (localhost). */
function isLocal(): boolean {
  return typeof window !== "undefined" && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
}

function SimpleBody({ file, kind }: { file: ProjectFile; kind: FileKind }) {
  switch (kind) {
    case "image":
      return <ImageView file={file} />;
    case "pdf":
      return <iframe src={fileUrl(file)} title={file.name} className="h-full min-h-[70vh] w-full border-0" />;
    case "word":
      return <WordView file={file} />;
    case "excel":
      return <ExcelView file={file} />;
    case "powerpoint":
      return <PowerPointView file={file} />;
    case "text":
      return <TextView file={file} />;
    default:
      return <Message>Ce format ne peut pas être affiché ici. Télécharge le fichier pour l&apos;ouvrir.</Message>;
  }
}

// Fichier Office : visionneuse Microsoft par défaut (en ligne, si le fichier n'est pas trop gros),
// avec un bouton pour revenir à l'aperçu simplifié qui ne quitte pas le site.
function Body({ file, kind }: { file: ProjectFile; kind: FileKind }) {
  const limit = officeLimit(file.ext);
  const local = isLocal();
  const possible = limit !== null && file.size <= limit && !local;
  const [microsoft, setMicrosoft] = useState(true);
  if (limit === null) return <SimpleBody file={file} kind={kind} />;

  const why = local
    ? "La visionneuse Microsoft ne marche qu'en ligne (pas en local) : aperçu simplifié."
    : file.size > limit
      ? `Fichier trop lourd pour la visionneuse Microsoft (${formatSize(limit)} maximum) : aperçu simplifié.`
      : null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-3 py-1.5 text-[11px] text-neutral-500">
        {possible ? (
          <>
            <span className="min-w-0 flex-1">
              {microsoft
                ? "Affichage Microsoft : le fichier passe par Microsoft le temps de l'affichage."
                : "Aperçu simplifié : le fichier ne quitte pas le site."}
            </span>
            <button
              type="button"
              onClick={() => setMicrosoft((m) => !m)}
              className="shrink-0 rounded-md px-2 py-0.5 font-medium text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50"
            >
              {microsoft ? "Aperçu simplifié" : "Affichage fidèle (Microsoft)"}
            </button>
          </>
        ) : (
          <span>{why}</span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {possible && microsoft ? <MicrosoftView file={file} /> : <SimpleBody file={file} kind={kind} />}
      </div>
    </div>
  );
}

export function FileViewer({ file, onClose, onSwap }: Props) {
  const kind = FILE_TYPES[file.ext]?.kind ?? "other";
  return (
    <section className="no-print flex h-[75vh] min-w-0 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200 lg:h-[calc(100vh-2rem)]" aria-label={`Fichier : ${file.name}`}>
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
        <FileIcon ext={file.ext} />
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium" title={file.name}>
          {file.name}
        </h2>
        <button type="button" onClick={onSwap} title="Changer de côté" aria-label="Changer de côté" className="hidden rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 lg:block">
          <ArrowLeftRight size={15} aria-hidden />
        </button>
        <a href={fileUrl(file, true)} title="Télécharger" aria-label="Télécharger" className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100">
          <Download size={15} aria-hidden />
        </a>
        <button type="button" onClick={onClose} title="Fermer" aria-label="Fermer le fichier" className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100">
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-neutral-50">
        <Body key={file.id} file={file} kind={kind} />
      </div>
    </section>
  );
}
