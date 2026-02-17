export type ToolMode = "select" | "hand" | "sticky" | "rectangle" | "text";

export interface BoardObject {
  id: string;
  board_id: string;
  type: "sticky" | "rectangle" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text: string;
  z_index: number;
  created_by: string;
  updated_at: string;
  font_weight?: "normal" | "bold";
  font_style?: "normal" | "italic";
  text_decoration?: "none" | "underline";
  text_color?: string;
  text_align?: "left" | "center" | "right";
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
