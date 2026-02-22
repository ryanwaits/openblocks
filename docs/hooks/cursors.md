# Live Cursors

Real-time cursor tracking -- see where other users are pointing. Two layers: low-level hooks (`useCursors`, `useUpdateCursor` from `@waits/lively-react`) for data access, and pre-built UI components (`CursorOverlay`, `Cursor`, `useCursorTracking` from `@waits/lively-ui`) for drop-in rendering. Throttled at 50ms by default for performance.

---

## Quick Start

Ten lines to get live cursors working:

```tsx
import { RoomProvider } from "@waits/lively-react";
import { CursorOverlay, useCursorTracking } from "@waits/lively-ui";

function Canvas() {
  const { ref, onMouseMove } = useCursorTracking<HTMLDivElement>();

  return (
    <div ref={ref} onMouseMove={onMouseMove} className="relative h-screen w-full">
      <CursorOverlay />
      {/* your content here */}
    </div>
  );
}

function App() {
  return (
    <RoomProvider roomId="my-room" userId="user-1" displayName="Alice">
      <Canvas />
    </RoomProvider>
  );
}
```

That's it. `useCursorTracking` computes container-relative coordinates and broadcasts them. `CursorOverlay` renders every other user's cursor as a colored arrow with a name label.

---

## API Reference

| Export | Package | Signature | Returns | Description |
|---|---|---|---|---|
| `useCursors` | `@waits/lively-react` | `()` | `Map<string, CursorData>` | All cursor positions in the room, keyed by userId. |
| `useUpdateCursor` | `@waits/lively-react` | `()` | `(x, y, viewportPos?, viewportScale?) => void` | Stable function to broadcast cursor position. |
| `useCursorTracking` | `@waits/lively-ui` | `<T extends HTMLElement>()` | `{ ref: RefObject<T>, onMouseMove: (e) => void }` | Attach to a container; auto-broadcasts relative coordinates. |
| `CursorOverlay` | `@waits/lively-ui` | `({ className? })` | `JSX.Element` | Renders a `<Cursor>` for every other user. Excludes self. |
| `Cursor` | `@waits/lively-ui` | `({ x, y, color, displayName, className? })` | `JSX.Element` | Single cursor arrow + name label, positioned absolutely. |

---

## `CursorData` Type

Defined in `@waits/lively-types`:

```ts
interface CursorData {
  userId: string;
  displayName: string;
  color: string;
  x: number;           // container-relative X
  y: number;           // container-relative Y
  lastUpdate: number;  // timestamp (ms)
  viewportPos?: {      // optional viewport position
    x: number;
    y: number;
  };
  viewportScale?: number; // optional zoom level
}
```

The server enriches `ClientCursorMessage` (which only sends `x`, `y`, and optional viewport fields) with the user's `userId`, `displayName`, `color`, and `lastUpdate` before broadcasting.

---

## Pre-built UI (Recommended)

These components handle coordinate math, rendering, and self-filtering. Use these unless you need custom cursor rendering.

### `useCursorTracking`

Returns a `ref` and `onMouseMove` handler. Attach both to the same container element. The hook calls `useUpdateCursor` internally, computes coordinates relative to the container's bounding rect, and broadcasts them.

```tsx
import { useCursorTracking } from "@waits/lively-ui";

function Workspace() {
  const { ref, onMouseMove } = useCursorTracking<HTMLDivElement>();

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      className="relative h-full w-full"
    >
      <CursorOverlay />
      {children}
    </div>
  );
}
```

**How coordinates are computed:**

```
  Container bounding rect
  +---------------------------------+
  | (rect.left, rect.top)           |
  |                                 |
  |        * Mouse (clientX, clientY)
  |        |                        |
  |  broadcast x = clientX - rect.left
  |  broadcast y = clientY - rect.top
  |                                 |
  +---------------------------------+
```

### `CursorOverlay`

Renders a `<Cursor>` for every other user in the room. Automatically excludes the current user via `useSelf()`. Must be placed inside a `position: relative` container so absolute positioning works correctly.

```tsx
import { CursorOverlay } from "@waits/lively-ui";

// Minimal
<CursorOverlay />

// With custom class on each cursor element
<CursorOverlay className="z-50 transition-transform duration-75" />
```

**Props:**

| Prop | Type | Default | Description |
|---|---|---|---|
| `className` | `string` | `undefined` | Extra class names applied to each rendered `<Cursor>` element. |

### `Cursor`

A single cursor indicator: an SVG arrow with a drop shadow and a colored name label. Positioned absolutely via `transform: translate(x, y)` with `will-change: transform` for GPU compositing.

```tsx
import { Cursor } from "@waits/lively-ui";

<Cursor
  x={150}
  y={300}
  color="#e74c3c"
  displayName="Alice"
/>
```

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `x` | `number` | Yes | Horizontal position in pixels relative to container. |
| `y` | `number` | Yes | Vertical position in pixels relative to container. |
| `color` | `string` | Yes | CSS color for the arrow fill and name badge background. |
| `displayName` | `string` | Yes | Text shown in the name label next to the arrow. |
| `className` | `string` | No | Additional class names on the wrapper `div`. |

**Rendered structure:**

```
<div class="pointer-events-none absolute left-0 top-0" style="transform: translate(Xpx, Ypx)">
  <svg>  <!-- arrow icon, filled with `color`, white stroke -->
  <span>  <!-- name badge, `color` background, white text -->
</div>
```

---

## Low-level Hooks (Advanced)

Use these when you need custom cursor rendering, non-standard coordinate systems, or access to the raw cursor map.

### `useCursors`

Returns a `Map<string, CursorData>` of all cursor positions in the room, including the current user. Re-renders only when positions actually change -- uses a position-aware equality check (compares `x`, `y`, `viewportScale`, `viewportPos.x`, `viewportPos.y`).

```tsx
import { useCursors, useSelf } from "@waits/lively-react";

function CustomCursors() {
  const cursors = useCursors();
  const self = useSelf();

  return (
    <>
      {Array.from(cursors.entries())
        .filter(([id]) => id !== self?.userId)
        .map(([userId, cursor]) => (
          <div
            key={userId}
            className="absolute rounded-full w-4 h-4"
            style={{
              left: cursor.x,
              top: cursor.y,
              backgroundColor: cursor.color,
            }}
          />
        ))}
    </>
  );
}
```

**Note:** The returned Map includes the current user's cursor. Filter with `useSelf()` if you only want other users.

### `useUpdateCursor`

Returns a stable callback that sends cursor position to all other users. The underlying `room.updateCursor()` is throttled at 50ms (configurable via `cursorThrottleMs` in Room config). Uses trailing-edge throttle: if you call it during the throttle window, the last position is sent when the window expires.

```tsx
import { useUpdateCursor } from "@waits/lively-react";

function ManualTracking() {
  const updateCursor = useUpdateCursor();

  return (
    <div
      onMouseMove={(e) => {
        // Simple: container-relative coordinates
        const rect = e.currentTarget.getBoundingClientRect();
        updateCursor(e.clientX - rect.left, e.clientY - rect.top);
      }}
    />
  );
}
```

**Full signature:**

```ts
(
  x: number,
  y: number,
  viewportPos?: { x: number; y: number },
  viewportScale?: number
) => void
```

The optional `viewportPos` and `viewportScale` parameters are for apps with zoom/pan -- they let remote clients transform cursor positions correctly (see [Whiteboard example](#1-whiteboard--design-tool) below).

---

## Real-world Use Cases

### 1. Whiteboard / Design Tool

Cursors follow the mouse over an infinite canvas with zoom and pan. Screen coordinates must be transformed to canvas coordinates before broadcasting, and the viewport must be included so remote clients can reverse the transform.

```
  Screen space                          Canvas space
  +------------------+                  +----------------------------+
  | Browser window   |                  | Infinite canvas            |
  |                  |    transform     |                            |
  |    * mouse       |  ────────────>   |              * cursor      |
  |  (400, 300)      |                  |           (1200, 800)      |
  |                  |                  |                            |
  +------------------+                  +----------------------------+

  canvasX = (screenX - panX) / zoom
  canvasY = (screenY - panY) / zoom
```

```tsx
import { useUpdateCursor, useCursors, useSelf } from "@waits/lively-react";
import { Cursor } from "@waits/lively-ui";

function InfiniteCanvas() {
  const updateCursor = useUpdateCursor();
  const cursors = useCursors();
  const self = useSelf();

  // Camera state
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Transform to canvas coordinates
    const canvasX = (screenX - camera.x) / camera.zoom;
    const canvasY = (screenY - camera.y) / camera.zoom;

    updateCursor(
      canvasX,
      canvasY,
      { x: camera.x, y: camera.y },  // viewport position
      camera.zoom                      // viewport scale
    );
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative h-screen w-full overflow-hidden"
    >
      {/* Transform layer for canvas content */}
      <div
        style={{
          transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* canvas shapes go here */}
      </div>

      {/* Cursor layer: transform remote canvas coords back to screen coords */}
      {Array.from(cursors.entries())
        .filter(([id]) => id !== self?.userId)
        .map(([userId, cursor]) => {
          const screenX = cursor.x * camera.zoom + camera.x;
          const screenY = cursor.y * camera.zoom + camera.y;
          return (
            <Cursor
              key={userId}
              x={screenX}
              y={screenY}
              color={cursor.color}
              displayName={cursor.displayName}
            />
          );
        })}
    </div>
  );
}
```

### 2. Document Editor

Show cursor position as a colored caret in text. Instead of rendering pointer arrows, map cursor coordinates to a paragraph/character position and render an inline marker.

```tsx
import { useCursors, useUpdateCursor, useSelf } from "@waits/lively-react";

function TextEditor() {
  const updateCursor = useUpdateCursor();
  const cursors = useCursors();
  const self = useSelf();
  const editorRef = useRef<HTMLDivElement>(null);

  const handleSelect = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorRef.current) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();

    // Broadcast caret position relative to editor
    updateCursor(rect.left - editorRect.left, rect.top - editorRect.top);
  };

  const otherCursors = Array.from(cursors.entries())
    .filter(([id]) => id !== self?.userId);

  return (
    <div ref={editorRef} onSelect={handleSelect} className="relative">
      <div contentEditable className="prose p-4" />

      {/* Render carets instead of arrows */}
      {otherCursors.map(([userId, cursor]) => (
        <div
          key={userId}
          className="absolute w-0.5 h-5 animate-pulse"
          style={{
            left: cursor.x,
            top: cursor.y,
            backgroundColor: cursor.color,
          }}
        >
          <span
            className="absolute -top-5 left-1 text-[10px] whitespace-nowrap px-1 rounded text-white"
            style={{ backgroundColor: cursor.color }}
          >
            {cursor.displayName}
          </span>
        </div>
      ))}
    </div>
  );
}
```

### 3. Spreadsheet

Highlight which cell each user is focused on. Use cursor position to communicate cell reference and render a colored border.

```tsx
import { useCursors, useUpdateCursor, useSelf } from "@waits/lively-react";

function Spreadsheet() {
  const updateCursor = useUpdateCursor();
  const cursors = useCursors();
  const self = useSelf();

  const CELL_W = 120;
  const CELL_H = 32;
  const COLS = ["A", "B", "C", "D", "E"];
  const ROWS = 20;

  // Broadcast which cell is focused using grid coordinates
  const handleCellFocus = (col: number, row: number) => {
    updateCursor(col, row); // x = column index, y = row index
  };

  // Build a map of cell -> list of users focused there
  const cellUsers = new Map<string, CursorData[]>();
  cursors.forEach((cursor, userId) => {
    if (userId === self?.userId) return;
    const key = `${Math.round(cursor.x)},${Math.round(cursor.y)}`;
    const list = cellUsers.get(key) || [];
    list.push(cursor);
    cellUsers.set(key, list);
  });

  return (
    <table className="border-collapse">
      <tbody>
        {Array.from({ length: ROWS }, (_, row) => (
          <tr key={row}>
            {COLS.map((colName, col) => {
              const viewers = cellUsers.get(`${col},${row}`) || [];
              return (
                <td
                  key={colName}
                  className="border px-2 py-1 relative"
                  style={{
                    width: CELL_W,
                    height: CELL_H,
                    outline: viewers.length
                      ? `2px solid ${viewers[0].color}`
                      : undefined,
                  }}
                  tabIndex={0}
                  onFocus={() => handleCellFocus(col, row)}
                >
                  {viewers.length > 0 && (
                    <span
                      className="absolute -top-4 left-0 text-[10px] px-1 text-white rounded-t"
                      style={{ backgroundColor: viewers[0].color }}
                    >
                      {viewers[0].displayName}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 4. Presentation Viewer

Presenter's cursor is visible to all viewers. One user broadcasts, everyone else watches. Read-only pattern.

```tsx
import { useCursors, useUpdateCursor, useSelf } from "@waits/lively-react";
import { Cursor } from "@waits/lively-ui";

function PresentationViewer({ presenterId }: { presenterId: string }) {
  const updateCursor = useUpdateCursor();
  const cursors = useCursors();
  const self = useSelf();
  const isPresenter = self?.userId === presenterId;

  return (
    <div
      className="relative w-[960px] h-[540px] mx-auto bg-white shadow-lg"
      onMouseMove={(e) => {
        // Only the presenter broadcasts cursor position
        if (!isPresenter) return;
        const rect = e.currentTarget.getBoundingClientRect();
        updateCursor(e.clientX - rect.left, e.clientY - rect.top);
      }}
    >
      {/* Slide content */}
      <SlideRenderer />

      {/* All viewers see the presenter's cursor */}
      {cursors.has(presenterId) && self?.userId !== presenterId && (
        <Cursor
          x={cursors.get(presenterId)!.x}
          y={cursors.get(presenterId)!.y}
          color={cursors.get(presenterId)!.color}
          displayName="Presenter"
        />
      )}

      {/* Presenter sees a subtle indicator that they're broadcasting */}
      {isPresenter && (
        <div className="absolute top-2 right-2 text-xs bg-red-500 text-white px-2 py-1 rounded">
          LIVE
        </div>
      )}
    </div>
  );
}
```

---

## Patterns & Tips

### Coordinate Systems

Always transform to your content's coordinate system before broadcasting. If you broadcast screen coordinates, remote users with different scroll positions or zoom levels will see cursors in the wrong place.

```
  Screen coords (clientX/Y)      Container-relative           Canvas coords
  ┌─────────────────┐            ┌─────────────────┐         ┌─────────────────┐
  │ browser window   │            │ container        │         │ content world   │
  │                  │  - rect    │                  │  / zoom │                 │
  │   * (800, 500)  │ ────────>  │   * (300, 200)  │ ──────> │  * (600, 400)  │
  │                  │            │                  │  - pan  │                 │
  └─────────────────┘            └─────────────────┘         └─────────────────┘

  useCursorTracking does:  screen -> container-relative  (step 1)
  You may also need:       container-relative -> canvas  (step 2, if zoom/pan)
```

### Performance

- **Throttling is built in.** `room.updateCursor()` throttles at 50ms (~20 updates/sec) with trailing-edge behavior. Do not add your own throttle on top -- it will add unnecessary latency.
- **Configurable via Room config:** pass `cursorThrottleMs` to adjust (minimum 1ms).
- **Equality checks prevent over-rendering.** `useCursors()` uses position-aware comparison -- re-renders only fire when `x`, `y`, `viewportScale`, or `viewportPos` actually change.
- **`will-change: transform`** is set on `<Cursor>` to enable GPU compositing. Avoid adding CSS transitions longer than ~75ms or the cursor will feel laggy.

### Viewport Awareness

If your app has zoom/pan, include viewport data so remote cursors render at the correct screen position:

```ts
updateCursor(
  canvasX,     // position in canvas/content coordinates
  canvasY,
  { x: panX, y: panY },  // current viewport offset
  zoomLevel               // current zoom scale
);
```

Remote clients use the broadcast canvas coordinates plus their own viewport to compute screen position:

```ts
const screenX = cursor.x * myZoom + myPanX;
const screenY = cursor.y * myZoom + myPanY;
```

### Hide Cursor on Mouse Leave

Clear the cursor when the mouse exits the tracked area. This prevents stale cursors lingering on other users' screens.

```tsx
function TrackedArea() {
  const { ref, onMouseMove } = useCursorTracking<HTMLDivElement>();
  const room = useRoom();

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={() => room.updateCursor(-1, -1)} // off-screen sentinel
      className="relative h-full w-full"
    >
      <CursorOverlay />
      {children}
    </div>
  );
}
```

### CSS Z-Index

`CursorOverlay` renders with `pointer-events-none` so it doesn't block clicks. Place it above your content but below modals and dropdowns:

```
z-index stacking:

  50+  Modals, dialogs, toasts
  40   CursorOverlay / cursor layer
  10   Toolbars, floating panels
   0   Canvas / document content
```

```tsx
<div className="relative">
  <CursorOverlay className="z-40" />
  <CanvasContent className="z-0" />
  <Toolbar className="z-10" />
  <Modal className="z-50" />
</div>
```

### Follow Mode

The `viewportPos` and `viewportScale` fields on `CursorData` power the [follow user](./use-follow-user.md) feature. When a user broadcasts viewport data, other clients can mirror their exact view.

> **See also:** [`useFollowUser`](./use-follow-user.md) — SDK-level hook for Figma-style follow mode with smooth viewport interpolation.

### Combining with Presence

Cursors and presence are complementary. Use `useCursors()` for real-time pointer position and `useOthers()` for user metadata. The `CursorData` includes `displayName` and `color` from the user's presence, so you don't need to join the two manually in most cases.

```tsx
import { useCursors, useOthers } from "@waits/lively-react";

function CollaborationPanel() {
  const cursors = useCursors();
  const others = useOthers();

  // Show online users with their cursor activity
  return (
    <ul>
      {others.map((user) => (
        <li key={user.userId} className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: user.color }}
          />
          <span>{user.displayName}</span>
          <span className="text-xs text-muted-foreground">
            {cursors.has(user.userId) ? "active" : "idle"}
          </span>
        </li>
      ))}
    </ul>
  );
}
```
