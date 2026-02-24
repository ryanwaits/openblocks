"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, RefreshCw, Play, Rewind, GripVertical } from "lucide-react";
import { streamsApi, type Delivery } from "@/lib/api/streams-client";
import { useBoardStore } from "@/lib/store/board-store";
import { usePanelResize } from "@/hooks/use-panel-resize";

interface DeliveryLogPanelProps {
  onClose: () => void;
}

export function DeliveryLogPanel({ onClose }: DeliveryLogPanelProps) {
  // Use selected workflow's stream, fall back to first with a streamId
  const streamId = useBoardStore((s) => {
    if (s.selectedWorkflowId) {
      const wf = s.workflows.get(s.selectedWorkflowId);
      if (wf?.stream.streamId) return wf.stream.streamId;
    }
    for (const wf of s.workflows.values()) {
      if (wf.stream.streamId) return wf.stream.streamId;
    }
    return null;
  });
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { width, handlePointerDown } = usePanelResize(384);

  const fetchDeliveries = useCallback(async (showLoading = true) => {
    if (!streamId) return;
    if (showLoading) setLoading(true);
    try {
      console.log("[DeliveryLogPanel] fetching deliveries for streamId:", streamId);
      const res = await streamsApi.deliveries(streamId, { limit: 50 });
      console.log("[DeliveryLogPanel] got", res.deliveries.length, "deliveries");
      setDeliveries(res.deliveries);
    } catch (err) {
      console.error("[DeliveryLogPanel] fetch failed for streamId:", streamId, err);
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  // Initial fetch + poll every 5s while panel is open
  useEffect(() => {
    fetchDeliveries();
    const interval = setInterval(() => fetchDeliveries(false), 5000);
    return () => clearInterval(interval);
  }, [fetchDeliveries]);

  if (!streamId) return null;

  return (
    <div className="group/panel relative flex h-full select-text flex-col border-l bg-white" style={{ width, borderColor: "#e5e7eb" }}>
      {/* Resize handle */}
      <div
        onPointerDown={handlePointerDown}
        className="absolute left-0 top-0 z-10 flex h-full w-2 cursor-col-resize items-center justify-center"
      >
        <div className="flex h-8 w-3.5 items-center justify-center rounded-sm bg-gray-200 opacity-0 transition-opacity group-hover/panel:opacity-100">
          <GripVertical size={10} className="text-gray-500" />
        </div>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "#e5e7eb" }}>
        <h3 className="text-sm font-semibold text-gray-900">Delivery Log</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fetchDeliveries()}
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <RefreshCw size={13} />
          </button>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Trigger / Replay controls */}
      <TriggerControls streamId={streamId} onTriggered={fetchDeliveries} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-gray-400">Loading...</div>
        ) : deliveries.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-xs text-gray-400">No deliveries yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {deliveries.map((d) => (
              <DeliveryRow
                key={d.id}
                delivery={d}
                expanded={expandedId === d.id}
                onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)}
                streamId={streamId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TriggerControls({ streamId, onTriggered }: { streamId: string; onTriggered: () => void }) {
  const [mode, setMode] = useState<"trigger" | "replay">("trigger");
  const [blockHeight, setBlockHeight] = useState("");
  const [fromBlock, setFromBlock] = useState("");
  const [toBlock, setToBlock] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleTrigger() {
    const height = parseInt(blockHeight);
    if (!height) return;
    setBusy(true);
    setFeedback(null);
    try {
      await streamsApi.trigger(streamId, height);
      setFeedback("Triggered");
      setBlockHeight("");
      setTimeout(() => { setFeedback(null); onTriggered(); }, 1500);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReplay() {
    const from = parseInt(fromBlock);
    const to = parseInt(toBlock);
    if (!from || !to || to < from) return;
    setBusy(true);
    setFeedback(null);
    try {
      await streamsApi.replay(streamId, from, to);
      setFeedback(`Replaying ${to - from + 1} blocks`);
      setFromBlock("");
      setToBlock("");
      setTimeout(() => { setFeedback(null); onTriggered(); }, 2000);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b px-4 py-3" style={{ borderColor: "#e5e7eb" }}>
      {/* Mode tabs */}
      <div className="mb-2 flex gap-1">
        <button
          onClick={() => setMode("trigger")}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            mode === "trigger" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Play size={11} /> Trigger Block
        </button>
        <button
          onClick={() => setMode("replay")}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            mode === "replay" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Rewind size={11} /> Replay Range
        </button>
      </div>

      {mode === "trigger" ? (
        <div className="flex gap-1.5">
          <input
            type="number"
            value={blockHeight}
            onChange={(e) => setBlockHeight(e.target.value)}
            placeholder="Block height"
            className="flex-1 rounded-md border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500"
            style={{ borderColor: "#e5e7eb" }}
            onKeyDown={(e) => e.key === "Enter" && handleTrigger()}
          />
          <button
            onClick={handleTrigger}
            disabled={busy || !blockHeight}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            Run
          </button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <input
            type="number"
            value={fromBlock}
            onChange={(e) => setFromBlock(e.target.value)}
            placeholder="From"
            className="w-24 rounded-md border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500"
            style={{ borderColor: "#e5e7eb" }}
          />
          <input
            type="number"
            value={toBlock}
            onChange={(e) => setToBlock(e.target.value)}
            placeholder="To"
            className="w-24 rounded-md border bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-500"
            style={{ borderColor: "#e5e7eb" }}
          />
          <button
            onClick={handleReplay}
            disabled={busy || !fromBlock || !toBlock}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            Replay
          </button>
        </div>
      )}

      {feedback && (
        <p className={`mt-1.5 text-[11px] ${feedback.startsWith("Failed") || feedback.startsWith("HTTP") ? "text-red-500" : "text-green-600"}`}>
          {feedback}
        </p>
      )}
    </div>
  );
}

function JsonSyntax({ data }: { data: unknown }) {
  function render(value: unknown, indent: number): React.ReactNode[] {
    const pad = "  ".repeat(indent);
    const elements: React.ReactNode[] = [];

    if (value === null) {
      elements.push(<span key="null" className="text-gray-400">null</span>);
    } else if (typeof value === "boolean") {
      elements.push(<span key="bool" className="text-purple-600">{String(value)}</span>);
    } else if (typeof value === "number") {
      elements.push(<span key="num" className="text-blue-600">{value}</span>);
    } else if (typeof value === "string") {
      elements.push(<span key="str" className="text-green-700">&quot;{value}&quot;</span>);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        elements.push(<span key="empty-arr">[]</span>);
      } else {
        elements.push(<span key="arr-open">{"[\n"}</span>);
        value.forEach((item, i) => {
          elements.push(
            <span key={`arr-${i}`}>
              {pad + "  "}
              {render(item, indent + 1)}
              {i < value.length - 1 ? ",\n" : "\n"}
            </span>
          );
        });
        elements.push(<span key="arr-close">{pad}]</span>);
      }
    } else if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        elements.push(<span key="empty-obj">{"{}"}</span>);
      } else {
        elements.push(<span key="obj-open">{"{\n"}</span>);
        entries.forEach(([key, val], i) => {
          elements.push(
            <span key={`obj-${key}`}>
              {pad + "  "}
              <span className="text-rose-600">&quot;{key}&quot;</span>
              <span className="text-gray-500">: </span>
              {render(val, indent + 1)}
              {i < entries.length - 1 ? ",\n" : "\n"}
            </span>
          );
        });
        elements.push(<span key="obj-close">{pad}{"}"}</span>);
      }
    }
    return elements;
  }

  return (
    <pre className="whitespace-pre text-[11px] leading-relaxed text-gray-800 font-mono">
      {render(data, 0)}
    </pre>
  );
}

function DeliveryRow({ delivery, expanded, onToggle, streamId }: { delivery: Delivery; expanded: boolean; onToggle: () => void; streamId: string }) {
  const [payload, setPayload] = useState<unknown>(null);
  const [loadingPayload, setLoadingPayload] = useState(false);

  useEffect(() => {
    if (!expanded || payload !== null) return;
    setLoadingPayload(true);
    streamsApi.delivery(streamId, delivery.id)
      .then((detail) => setPayload(detail.payload))
      .catch(() => setPayload(undefined))
      .finally(() => setLoadingPayload(false));
  }, [expanded, streamId, delivery.id, payload]);

  const StatusIcon = delivery.status === "success" ? CheckCircle
    : delivery.status === "failed" ? XCircle
    : Clock;

  const statusColor = delivery.status === "success" ? "text-green-500"
    : delivery.status === "failed" ? "text-red-500"
    : "text-yellow-500";

  const time = new Date(delivery.createdAt);
  const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-gray-50"
      >
        {expanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
        <StatusIcon size={14} className={statusColor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-900">Block #{delivery.blockHeight}</span>
            {delivery.statusCode && (
              <span className="text-[10px] text-gray-400">{delivery.statusCode}</span>
            )}
          </div>
        </div>
        <span className="text-[11px] text-gray-400">{timeStr}</span>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
          {delivery.error && (
            <p className="mb-2 text-xs text-red-600">{delivery.error}</p>
          )}
          {loadingPayload ? (
            <p className="text-xs text-gray-400">Loading payload...</p>
          ) : payload != null ? (
            <div className="max-h-80 overflow-auto rounded-lg border bg-white p-3" style={{ borderColor: "#e5e7eb" }}>
              <JsonSyntax data={payload} />
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No payload data</p>
          )}
        </div>
      )}
    </div>
  );
}
