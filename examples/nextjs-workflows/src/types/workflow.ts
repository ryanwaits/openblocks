import type { NodeConfigMap } from "./node-configs";

export interface Position {
  x: number;
  y: number;
}

export type PortDirection = "input" | "output";
export type PortDataType = "event" | "filtered" | "action";

export interface Port {
  id: string;
  direction: PortDirection;
  dataType: PortDataType;
  label: string;
}

export type WorkflowNodeType =
  | "event-trigger"
  | "stx-filter"
  | "ft-filter"
  | "nft-filter"
  | "contract-call-filter"
  | "contract-deploy-filter"
  | "print-event-filter"
  | "webhook-action";

export interface WorkflowNode<T extends WorkflowNodeType = WorkflowNodeType> {
  id: string;
  type: T;
  position: Position;
  config: NodeConfigMap[T];
  label: string;
}

export interface WorkflowEdge {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}
