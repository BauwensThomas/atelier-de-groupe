import { File, FileImage, FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { FILE_TYPES } from "@/lib/file-types";

// Icône selon le type de fichier.
export function FileIcon({ ext, size = 16 }: { ext: string; size?: number }) {
  const kind = FILE_TYPES[ext]?.kind;
  if (kind === "image") return <FileImage size={size} className="shrink-0 text-violet-600" aria-hidden />;
  if (kind === "pdf") return <FileText size={size} className="shrink-0 text-red-600" aria-hidden />;
  if (kind === "word" || ext === "doc" || ext === "odt") return <FileText size={size} className="shrink-0 text-blue-600" aria-hidden />;
  if (kind === "excel") return <FileSpreadsheet size={size} className="shrink-0 text-green-700" aria-hidden />;
  if (kind === "powerpoint" || ext === "ppt" || ext === "odp") return <Presentation size={size} className="shrink-0 text-orange-600" aria-hidden />;
  return <File size={size} className="shrink-0 text-neutral-500" aria-hidden />;
}
