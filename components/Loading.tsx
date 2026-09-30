import { Loader2 } from "lucide-react";

export function Loading({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-neutral-500" role="status">
      <Loader2 size={18} className="animate-spin" aria-hidden />
      {text}
    </div>
  );
}
