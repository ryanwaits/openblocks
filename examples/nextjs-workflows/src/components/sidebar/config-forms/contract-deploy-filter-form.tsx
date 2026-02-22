"use client";

import type { ContractDeployFilterConfig } from "@/types/node-configs";
import { FormField, TextInput } from "./form-field";

export function ContractDeployFilterForm({
  config,
  onChange,
}: {
  config: ContractDeployFilterConfig;
  onChange: (c: Partial<ContractDeployFilterConfig>) => void;
}) {
  return (
    <>
      <FormField label="Deployer">
        <TextInput value={config.deployer ?? ""} onChange={(v) => onChange({ deployer: v || undefined })} placeholder="SP... (optional)" />
      </FormField>
      <FormField label="Contract Name">
        <TextInput value={config.contractName ?? ""} onChange={(v) => onChange({ contractName: v || undefined })} placeholder="contract-name (supports *)" />
      </FormField>
    </>
  );
}
