export type ToolMode = "select" | "hand" | "sticky" | "rectangle" | "text" | "circle" | "diamond" | "pill" | "line";

export interface BoardObject {
  id: string;
  board_id: string;
  type: "sticky" | "rectangle" | "text" | "circle" | "diamond" | "pill" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text: string;
  z_index: number;
  created_by: string | null;
  created_by_name?: string;
  updated_at: string;
  font_weight?: "normal" | "bold";
  font_style?: "normal" | "italic";
  text_decoration?: "none" | "underline";
  text_color?: string;
  text_align?: "left" | "center" | "right";
  // Line/connector fields
  points?: Array<{ x: number; y: number }>;
  stroke_color?: string;
  stroke_width?: number;
  start_arrow?: boolean;
  end_arrow?: boolean;
  start_object_id?: string | null;
  end_object_id?: string | null;
  label?: string;
  rotation?: number;
}

export interface Frame {
  id: string;
  index: number;
  label: string;
}

export interface CursorData {
  userId: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
  lastUpdate: number;
}

export interface PresenceUser {
  userId: string;
  displayName: string;
  color: string;
  connectedAt: number;
}
