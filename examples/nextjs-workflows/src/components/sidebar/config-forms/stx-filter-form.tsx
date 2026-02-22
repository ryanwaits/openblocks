"use client";

import type { StxFilterConfig, StxEventType } from "@/types/node-configs";
import { FormField, SelectInput, TextInput, NumberInput } from "./form-field";

export function StxFilterForm({
  config,
  onChange,
}: {
  config: StxFilterConfig;
  onChange: (c: Partial<StxFilterConfig>) => void;
}) {
  return (
    <>
      <FormField label="Event Type">
        <SelectInput
          value={config.eventType}
          onChange={(v) => onChange({ eventType: v as StxEventType })}
          options={[
            { value: "transfer", label: "Transfer" },
            { value: "mint", label: "Mint" },
            { value: "burn", label: "Burn" },
            { value: "lock", label: "Lock" },
          ]}
        />
      </FormField>
      {config.eventType === "transfer" && (
        <>
          <FormField label="Sender">
            <TextInput
              value={config.sender ?? ""}
              onChange={(v) => onChange({ sender: v || undefined })}
              placeholder="SP... (optional)"
            />
          </FormField>
          <FormField label="Recipient">
            <TextInput
              value={config.recipient ?? ""}
              onChange={(v) => onChange({ recipient: v || undefined })}
              placeholder="SP... (optional)"
            />
          </FormField>
        </>
      )}
      {config.eventType === "lock" && (
        <FormField label="Locked Address">
          <TextInput
            value={config.sender ?? ""}
            onChange={(v) => onChange({ sender: v || undefined })}
            placeholder="SP... (optional)"
          />
        </FormField>
      )}
      <FormField label="Min Amount">
        <NumberInput
          value={config.minAmount}
          onChange={(v) => onChange({ minAmount: v })}
          placeholder="No minimum"
        />
      </FormField>
      {config.eventType === "transfer" && (
        <FormField label="Max Amount">
          <NumberInput
            value={config.maxAmount}
            onChange={(v) => onChange({ maxAmount: v })}
            placeholder="No maximum"
          />
        </FormField>
      )}
    </>
  );
}
