"use client";

import type { EventTriggerConfig } from "@/types/node-configs";
import { FormField, NumberInput } from "./form-field";

export function EventTriggerForm({
  config,
  onChange,
}: {
  config: EventTriggerConfig;
  onChange: (c: Partial<EventTriggerConfig>) => void;
}) {
  return (
    <FormField label="Start Block">
      <NumberInput
        value={config.startBlock}
        onChange={(v) => onChange({ startBlock: v })}
        placeholder="Latest"
      />
    </FormField>
  );
}
