import { createClient } from "./client";

export interface Board {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  object_count: number;
}

export async function fetchBoards(): Promise<Board[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("boards")
    .select("id, name, created_by, created_at, board_objects(count)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    created_by: row.created_by,
    created_at: row.created_at,
    object_count: (row.board_objects as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
}

export async function createBoard(name: string, userId: string): Promise<Board> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("boards")
    .insert({ name, created_by: userId })
    .select("id, name, created_by, created_at")
    .single();

  if (error) throw error;
  return { ...data, object_count: 0 };
}
