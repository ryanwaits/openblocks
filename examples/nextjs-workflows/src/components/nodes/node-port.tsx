"use client";

import type { Port, PortDataType } from "@/types/workflow";

const PORT_COLORS: Record<PortDataType, string> = {
  event: "#f59e0b",
  filtered: "#3b82f6",
  action: "#10b981",
};

interface NodePortProps {
  port: Port;
  nodeWidth: number;
  index: number;
  totalPorts: number;
  onPointerDown?: (e: React.PointerEvent) => void;
}

export const NODE_PORT_RADIUS = 6;

export function getPortPosition(
  port: Port,
  nodeWidth: number,
  index: number,
  totalPorts: number,
): { cx: number; cy: number } {
  // Ports of same direction are spaced evenly along the edge
  const sameDirectionIndex = index;
  const spacing = 40;
  const baseY = 40 + sameDirectionIndex * spacing;
  const cx = port.direction === "input" ? 0 : nodeWidth;
  return { cx, cy: baseY };
}

export function NodePort({ port, nodeWidth, index, totalPorts, onPointerDown }: NodePortProps) {
  const color = PORT_COLORS[port.dataType];
  const { cx, cy } = getPortPosition(port, nodeWidth, index, totalPorts);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={NODE_PORT_RADIUS}
      fill={color}
      stroke="white"
      strokeWidth={2}
      style={{ cursor: "crosshair", transition: "transform 0.1s" }}
      data-port-id={port.id}
      data-port-direction={port.direction}
      data-node-port="true"
      onPointerDown={onPointerDown}
    >
      <title>{port.label}</title>
    </circle>
  );
}
