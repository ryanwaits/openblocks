"use client";

import type { EventTriggerConfig, TriggerMode } from "@/types/node-configs";
import { FormField, NumberInput, SelectInput } from "./form-field";

const MODE_OPTIONS: { value: TriggerMode; label: string }[] = [
  { value: "live", label: "New blocks only" },
  { value: "single-block", label: "Single block" },
  { value: "range", label: "Block range" },
];

export function EventTriggerForm({
  config,
  onChange,
}: {
  config: EventTriggerConfig;
  onChange: (c: Partial<EventTriggerConfig>) => void;
}) {
  const mode = config.triggerMode ?? "live";

  const handleModeChange = (newMode: TriggerMode) => {
    onChange({
      triggerMode: newMode,
      startBlock: undefined,
      endBlock: undefined,
      singleBlock: undefined,
    });
  };

  return (
    <>
      <FormField label="Trigger Mode">
        <SelectInput value={mode} onChange={handleModeChange} options={MODE_OPTIONS} />
      </FormField>

      {mode === "live" && (
        <p className="text-[11px] text-gray-400 -mt-1 mb-3">
          Processes new blocks as they arrive
        </p>
      )}

      {mode === "range" && (
        <>
          <FormField label="From">
            <NumberInput
              value={config.startBlock}
              onChange={(v) => onChange({ startBlock: v })}
              placeholder="Block height"
            />
          </FormField>
          <FormField label="To">
            <NumberInput
              value={config.endBlock}
              onChange={(v) => onChange({ endBlock: v })}
              placeholder="Block height"
            />
          </FormField>
        </>
      )}

      {mode === "single-block" && (
        <FormField label="Block Height">
          <NumberInput
            value={config.singleBlock}
            onChange={(v) => onChange({ singleBlock: v })}
            placeholder="Block height"
          />
        </FormField>
      )}
    </>
  );
}
