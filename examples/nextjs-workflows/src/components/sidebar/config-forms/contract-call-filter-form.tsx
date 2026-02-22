"use client";

import type { ContractCallFilterConfig } from "@/types/node-configs";
import { FormField, TextInput } from "./form-field";

export function ContractCallFilterForm({
  config,
  onChange,
}: {
  config: ContractCallFilterConfig;
  onChange: (c: Partial<ContractCallFilterConfig>) => void;
}) {
  return (
    <>
      <FormField label="Contract ID">
        <TextInput value={config.contractId ?? ""} onChange={(v) => onChange({ contractId: v || undefined })} placeholder="SP..contract-name" />
      </FormField>
      <FormField label="Function Name">
        <TextInput value={config.functionName ?? ""} onChange={(v) => onChange({ functionName: v || undefined })} placeholder="function-name (optional)" />
      </FormField>
      <FormField label="Caller">
        <TextInput value={config.caller ?? ""} onChange={(v) => onChange({ caller: v || undefined })} placeholder="SP... (optional)" />
      </FormField>
    </>
  );
}
