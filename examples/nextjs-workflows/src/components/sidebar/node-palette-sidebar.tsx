"use client";

import { NodeIcon } from "@/components/icons/node-icon";
import { useCanvasInteractionStore } from "@/lib/store/canvas-interaction-store";
import { NODE_DEFINITIONS, CATEGORIES } from "@/lib/workflow/node-definitions";
import type { WorkflowNodeType } from "@/types/workflow";

export function NodePaletteSidebar() {
  const placementMode = useCanvasInteractionStore((s) => s.placementMode);
  const setPlacementMode = useCanvasInteractionStore((s) => s.setPlacementMode);

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    nodes: Object.values(NODE_DEFINITIONS).filter((d) => d.category === cat.key),
  }));

  return (
    <div className="flex h-full w-56 flex-col border-r bg-white" style={{ borderColor: "#e5e7eb" }}>
      <div className="border-b px-4 py-3" style={{ borderColor: "#e5e7eb" }}>
        <h2 className="text-sm font-semibold text-gray-900">Nodes</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {grouped.map((group) => (
          <div key={group.key}>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.nodes.map((def) => (
                <NodePaletteItem
                  key={def.type}
                  type={def.type}
                  label={def.label}
                  icon={def.icon}
                  color={def.color}
                  isActive={placementMode?.nodeType === def.type}
                  onClick={() => {
                    if (placementMode?.nodeType === def.type) {
                      setPlacementMode(null);
                    } else {
                      setPlacementMode({ nodeType: def.type });
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NodePaletteItem({
  type,
  label,
  icon,
  color,
  isActive,
  onClick,
}: {
  type: WorkflowNodeType;
  label: string;
  icon: string;
  color: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", type);
        e.dataTransfer.effectAllowed = "copy";
      }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
        isActive ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-gray-50"
      }`}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: color + "18" }}
      >
        <NodeIcon icon={icon} size={14} color={color} />
      </div>
      <span className="text-xs font-medium text-gray-800">{label}</span>
    </button>
  );
}
