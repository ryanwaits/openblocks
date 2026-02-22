# Feature Implementation Reference

## Board Features

### Workspace (Pan/Zoom)
Infinite canvas using Konva `Stage` with smooth pan (arrow keys, drag) and zoom (Ctrl+scroll, pinch). Scale bounded 0.02x–10x via `viewport-store`. Board auto-navigates to last active frame at 100% zoom on load.

### Sticky Notes
Click-to-place sticky notes with inline text editing (double-click). 8 color presets via color picker in the selection toolbar. Default 200x200, yellow (#fef08a). Supports drag, resize, and rotate transforms.

### Shapes
Four shape primitives — rectangle, circle, diamond, pill — each rendered as a dedicated Konva component with solid fill colors. All shapes support transforms (move, resize, rotate) and color changes via toolbar.

### Connectors
Line tool draws polylines with click-to-place points and double-click/Enter to finalize. Lines snap to object edges, support bend points (click midpoint handle to add), endpoint arrows, and text labels. Connected lines track `start_object_id`/`end_object_id` for persistent attachment.

### Text
Standalone text elements placed via text tool. Inline editing on double-click with a formatting toolbar for bold, italic, underline, and text alignment (left/center/right). Text color customizable via `text_color` property.

### Frames
Content areas that organize the board into navigable sections. Created via sidebar "+" button with animated zoom-to-frame navigation. Frames laid out horizontally (4000x3000 each, 200px gap). Deletion cascades to all contained objects via Supabase cleanup. Minimum 1 frame enforced. Last active frame persisted to localStorage.

### Transforms
All objects support move (drag), resize (corner/edge handles), and rotate (top handle). Multi-select transforms apply delta to all selected objects simultaneously. Every transform broadcasts in real-time and records to undo history.

### Selection
Single-click selects one object; shift+click toggles multi-select. Drag on empty canvas draws a selection rectangle — all objects within bounds are selected on release. Visual feedback via blue dashed border on selected objects.

### Operations
Delete (Delete/Backspace) with cascade removal of connected lines. Duplicate (Cmd+D) creates offset copies with new IDs. Copy/paste (Cmd+C/V) via clipboard ref. Full undo/redo (Cmd+Z / Cmd+Shift+Z) tracking create, delete, and update actions.

## Real-Time Collaboration

### Multiplayer Cursors
Cursor positions broadcast at 60Hz (16ms throttle) via Lively server `cursor:update` messages. Remote cursors rendered with smooth lerp interpolation (factor 0.3), colored arrows, and display name labels. Colors deterministically assigned per userId via hash.

### Sync
All object mutations (create/update/delete) broadcast to connected clients via Lively server before persisting to Supabase. Clients apply changes to Zustand stores on message receipt for instant visual feedback. Ephemeral flag on updates skips persistence for intermediate states (e.g., mid-drag).

### Presence
Server tracks connected users with userId, displayName, color, and connectedAt. Presence list broadcast on every connect/disconnect. UI renders up to 4 user avatars with initials in top-right corner, with "+N" overflow indicator. Stale cursors auto-removed on disconnect.

### Persistence
All board state persisted to Supabase — objects via individual row inserts/updates/deletes, frames via JSONB column on the boards table. Server loads full state from Supabase on room start (`onStart`). Every new client connection receives a full `sync` + `frame:sync` payload, so board state survives all users leaving and returning.

### Conflict Resolution
Last-write-wins (LWW) strategy using `updated_at` ISO timestamps. Server compares incoming `updated_at` against stored value and accepts if newer or equal. Acceptable tradeoff for a visual whiteboard where objects have few fields and simultaneous edits to the same object are rare. No operational transform or CRDT — overwrites are atomic at the object level.

### Resilience
Lively client provides automatic reconnection with exponential backoff (1s–10s, 1.3x growth, infinite retries) and message buffering during disconnect. On reconnect, server re-sends full object and frame state via `onConnect`. UI shows "Reconnecting..." badge when connection drops, clearing automatically when restored. No manual page reload required.
