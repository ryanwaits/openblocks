import type { Port, PortDataType } from "@/types/workflow";
import { NODE_DEFINITIONS } from "./node-definitions";

/** Valid flow: event→filtered→action */
const FLOW_RULES: Record<PortDataType, PortDataType[]> = {
  event: ["event", "filtered"],
  filtered: ["filtered", "action"],
  action: [],
};

/**
 * Check if a connection from sourcePort to targetPort is valid.
 * Rules: output→input only, dataType compatibility, no self-connections.
 */
export function canConnect(
  sourceNodeId: string,
  sourcePort: Port,
  targetNodeId: string,
  targetPort: Port,
): boolean {
  // No self-connections
  if (sourceNodeId === targetNodeId) return false;
  // Must be output→input
  if (sourcePort.direction !== "output" || targetPort.direction !== "input") return false;
  // Check dataType flow
  const allowed = FLOW_RULES[sourcePort.dataType];
  return allowed.includes(targetPort.dataType);
}

/**
 * Find a port definition from node definitions by nodeType and portId.
 */
export function findPort(nodeType: string, portId: string): Port | undefined {
  const def = NODE_DEFINITIONS[nodeType as keyof typeof NODE_DEFINITIONS];
  if (!def) return undefined;
  return def.ports.find((p) => p.id === portId);
}
