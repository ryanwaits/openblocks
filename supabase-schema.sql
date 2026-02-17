-- Drop existing tables (cascade drops board_objects via FK)
DROP TABLE IF EXISTS board_objects CASCADE;
DROP TABLE IF EXISTS boards CASCADE;

-- Boards table
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Untitled Board',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Board objects table
CREATE TABLE board_objects (
  id UUID PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sticky', 'rectangle', 'text', 'circle', 'diamond', 'pill', 'line')),
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  width DOUBLE PRECISION NOT NULL DEFAULT 200,
  height DOUBLE PRECISION NOT NULL DEFAULT 200,
  color TEXT NOT NULL DEFAULT '#fef08a',
  text TEXT NOT NULL DEFAULT '',
  z_index INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_by_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  font_weight TEXT,
  font_style TEXT,
  text_decoration TEXT,
  text_color TEXT,
  text_align TEXT,
  points JSONB,
  stroke_color TEXT,
  stroke_width DOUBLE PRECISION,
  start_arrow BOOLEAN,
  end_arrow BOOLEAN,
  start_object_id UUID,
  end_object_id UUID,
  label TEXT
);

CREATE INDEX idx_board_objects_board_id ON board_objects(board_id);

-- RLS policies
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_objects ENABLE ROW LEVEL SECURITY;

-- Anyone can read boards
CREATE POLICY "boards_select" ON boards FOR SELECT USING (true);
-- Authenticated users can insert boards
CREATE POLICY "boards_insert" ON boards FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Anyone can read board objects
CREATE POLICY "board_objects_select" ON board_objects FOR SELECT USING (true);
-- Authenticated users can insert/update/delete board objects
CREATE POLICY "board_objects_insert" ON board_objects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "board_objects_update" ON board_objects FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "board_objects_delete" ON board_objects FOR DELETE USING (auth.uid() IS NOT NULL);

-- Seed default board
INSERT INTO boards (id, name) VALUES ('00000000-0000-0000-0000-000000000000', 'Default Board');
