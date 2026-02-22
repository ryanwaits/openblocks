/**
 * Convert screen (client) coordinates to canvas coordinates
 * using the current viewport position and scale.
 */
export function screenToCanvas(
  clientX: number,
  clientY: number,
  svgRect: DOMRect,
  pos: { x: number; y: number },
  scale: number,
): { x: number; y: number } {
  return {
    x: (clientX - svgRect.left - pos.x) / scale,
    y: (clientY - svgRect.top - pos.y) / scale,
  };
}
