"use client";

import { useBoardStore } from "@/lib/store/board-store";
import { NODE_DEFINITIONS } from "@/lib/workflow/node-definitions";
import { getPortPosition } from "@/components/nodes/node-port";
import { computeBezierPath } from "@/lib/workflow/edge-routing";
import { NODE_WIDTH, getNodeHeight } from "@/components/nodes/base-node";

/** Animated dots that flow along a bezier edge path */
function FlowParticles({ pathD, edgeId }: { pathD: string; edgeId: string }) {
  const particles = [
    { delay: "0s", dur: "2.5s" },
    { delay: "0.8s", dur: "2.5s" },
    { delay: "1.6s", dur: "2.5s" },
  ];

  return (
    <>
      {particles.map((p, i) => (
        <circle key={`${edgeId}-p${i}`} r="3" fill="#7b61ff" filter="url(#flowGlow)">
          <animateMotion
            dur={p.dur}
            repeatCount="indefinite"
            begin={p.delay}
            path={pathD}
            rotate="auto"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.1;0.9;1"
            dur={p.dur}
            begin={p.delay}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </>
  );
}

export function EdgeLayer() {
  const nodes = useBoardStore((s) => s.nodes);
  const edges = useBoardStore((s) => s.edges);
  const selectedEdgeId = useBoardStore((s) => s.selectedEdgeId);
  const selectEdge = useBoardStore((s) => s.selectEdge);
  const workflows = useBoardStore((s) => s.workflows);

  // Check if any workflow is active (for the glow filter)
  const anyActive = Array.from(workflows.values()).some((wf) => wf.stream.status === "active");

  return (
    <g>
      {/* Glow filter for flow particles */}
      {anyActive && (
        <defs>
          <filter id="flowGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}

      {Array.from(edges.values()).map((edge) => {
        const sourceNode = nodes.get(edge.sourceNodeId);
        const targetNode = nodes.get(edge.targetNodeId);
        if (!sourceNode || !targetNode) return null;

        // Derive active state from the source node's workflow
        const wf = workflows.get(sourceNode.workflowId);
        const isActive = wf?.stream.status === "active";

        const sourceDef = NODE_DEFINITIONS[sourceNode.type];
        const targetDef = NODE_DEFINITIONS[targetNode.type];
        const sourcePort = sourceDef.ports.find((p) => p.id === edge.sourcePortId);
        const targetPort = targetDef.ports.find((p) => p.id === edge.targetPortId);
        if (!sourcePort || !targetPort) return null;

        const sourceOutputPorts = sourceDef.ports.filter((p) => p.direction === "output");
        const targetInputPorts = targetDef.ports.filter((p) => p.direction === "input");
        const sourceIdx = sourceOutputPorts.indexOf(sourcePort);
        const targetIdx = targetInputPorts.indexOf(targetPort);

        const sourceHeight = getNodeHeight(sourceNode);
        const targetHeight = getNodeHeight(targetNode);
        const sourcePortPos = getPortPosition(sourcePort, NODE_WIDTH, sourceIdx, sourceOutputPorts.length, sourceHeight);
        const targetPortPos = getPortPosition(targetPort, NODE_WIDTH, targetIdx, targetInputPorts.length, targetHeight);

        const sx = sourceNode.position.x + sourcePortPos.cx;
        const sy = sourceNode.position.y + sourcePortPos.cy;
        const tx = targetNode.position.x + targetPortPos.cx;
        const ty = targetNode.position.y + targetPortPos.cy;

        const pathD = computeBezierPath(sx, sy, tx, ty);
        const isSelected = edge.id === selectedEdgeId;

        const edgeStroke = isActive
          ? (isSelected ? "#7b61ff" : "#a78bfa")
          : (isSelected ? "#7b61ff" : "#d1d5db");

        return (
          <g key={edge.id}>
            {/* Wider invisible hit area */}
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); selectEdge(edge.id); }}
            />
            <path
              d={pathD}
              fill="none"
              stroke={edgeStroke}
              strokeWidth={isSelected ? 2.5 : 2}
              strokeDasharray={isActive && !isSelected ? "4 4" : undefined}
              style={{ cursor: "pointer", transition: "stroke 0.15s" }}
              onClick={(e) => { e.stopPropagation(); selectEdge(edge.id); }}
            >
              {isActive && !isSelected && (
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-8"
                  dur="1s"
                  repeatCount="indefinite"
                />
              )}
            </path>

            {/* Flow particles when workflow is active */}
            {isActive && <FlowParticles pathD={pathD} edgeId={edge.id} />}
          </g>
        );
      })}
    </g>
  );
}
