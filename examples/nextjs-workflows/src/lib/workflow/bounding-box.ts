import type { WorkflowNode } from "@/types/workflow";
import { NODE_WIDTH, getNodeHeight } from "@/components/nodes/base-node";

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function getWorkflowBBox(nodes: WorkflowNode[]): BBox {
  if (nodes.length === 0) return { x: 0, y: 0, w: 0, h: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const h = getNodeHeight(node);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
    maxY = Math.max(maxY, node.position.y + h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function getWorkflowCenter(nodes: WorkflowNode[]): { x: number; y: number } {
  const bbox = getWorkflowBBox(nodes);
  return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
}
