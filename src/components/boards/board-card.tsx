import Link from "next/link";
import type { Board } from "@/lib/supabase/boards";

const ACCENT_COLORS = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function accentColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

const DEFAULT_BOARD_ID = "00000000-0000-0000-0000-000000000000";

export function BoardCard({ board, objectCount }: { board: Board; objectCount?: number }) {
  const slug = board.id === DEFAULT_BOARD_ID ? "default" : board.id;
  return (
    <Link href={`/board/${slug}`}>
      <div className="group relative overflow-hidden rounded-lg border bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
        <div className={`h-2 ${accentColor(board.id)}`} />
        <div className="p-4">
          <h2 className="font-medium text-gray-900 truncate">{board.name}</h2>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <span>{new Date(board.created_at).toLocaleDateString()}</span>
            {objectCount !== undefined && (
              <>
                <span>&middot;</span>
                <span>{objectCount} {objectCount === 1 ? "object" : "objects"}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
