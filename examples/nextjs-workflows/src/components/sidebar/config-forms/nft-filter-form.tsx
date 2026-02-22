"use client";

import type { NftFilterConfig } from "@/types/node-configs";
import { FormField, SelectInput, TextInput } from "./form-field";

export function NftFilterForm({
  config,
  onChange,
}: {
  config: NftFilterConfig;
  onChange: (c: Partial<NftFilterConfig>) => void;
}) {
  return (
    <>
      <FormField label="Asset Identifier">
        <TextInput value={config.assetIdentifier ?? ""} onChange={(v) => onChange({ assetIdentifier: v || undefined })} placeholder="SP...::nft-name" />
      </FormField>
      <FormField label="Event Type">
        <SelectInput value={config.eventType} onChange={(v) => onChange({ eventType: v as NftFilterConfig["eventType"] })}
          options={[{ value: "transfer", label: "Transfer" }, { value: "mint", label: "Mint" }, { value: "burn", label: "Burn" }]} />
      </FormField>
      <FormField label="Sender">
        <TextInput value={config.sender ?? ""} onChange={(v) => onChange({ sender: v || undefined })} placeholder="SP... (optional)" />
      </FormField>
      <FormField label="Recipient">
        <TextInput value={config.recipient ?? ""} onChange={(v) => onChange({ recipient: v || undefined })} placeholder="SP... (optional)" />
      </FormField>
      <FormField label="Token ID">
        <TextInput value={config.tokenId ?? ""} onChange={(v) => onChange({ tokenId: v || undefined })} placeholder="Token ID (optional)" />
      </FormField>
    </>
  );
}
