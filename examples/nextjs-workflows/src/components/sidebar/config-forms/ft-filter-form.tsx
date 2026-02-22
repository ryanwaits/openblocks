"use client";

import type { FtFilterConfig } from "@/types/node-configs";
import { FormField, SelectInput, TextInput, NumberInput } from "./form-field";

export function FtFilterForm({
  config,
  onChange,
}: {
  config: FtFilterConfig;
  onChange: (c: Partial<FtFilterConfig>) => void;
}) {
  return (
    <>
      <FormField label="Asset Identifier">
        <TextInput value={config.assetIdentifier ?? ""} onChange={(v) => onChange({ assetIdentifier: v || undefined })} placeholder="SP...::token-name" />
      </FormField>
      <FormField label="Event Type">
        <SelectInput value={config.eventType} onChange={(v) => onChange({ eventType: v as FtFilterConfig["eventType"] })}
          options={[{ value: "transfer", label: "Transfer" }, { value: "mint", label: "Mint" }, { value: "burn", label: "Burn" }]} />
      </FormField>
      <FormField label="Sender">
        <TextInput value={config.sender ?? ""} onChange={(v) => onChange({ sender: v || undefined })} placeholder="SP... (optional)" />
      </FormField>
      <FormField label="Recipient">
        <TextInput value={config.recipient ?? ""} onChange={(v) => onChange({ recipient: v || undefined })} placeholder="SP... (optional)" />
      </FormField>
      <FormField label="Min Amount">
        <NumberInput value={config.minAmount} onChange={(v) => onChange({ minAmount: v })} placeholder="No minimum" />
      </FormField>
    </>
  );
}
