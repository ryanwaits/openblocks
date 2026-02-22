"use client";

import type { WebhookActionConfig } from "@/types/node-configs";
import { FormField, TextInput, NumberInput, CheckboxInput } from "./form-field";

export function WebhookActionForm({
  config,
  onChange,
}: {
  config: WebhookActionConfig;
  onChange: (c: Partial<WebhookActionConfig>) => void;
}) {
  return (
    <>
      <FormField label="URL">
        <TextInput
          value={config.url}
          onChange={(v) => onChange({ url: v })}
          placeholder="https://example.com/webhook"
        />
      </FormField>
      <FormField label="Retry Count">
        <NumberInput
          value={config.retryCount}
          onChange={(v) => onChange({ retryCount: v ?? 3 })}
          placeholder="3"
        />
      </FormField>
      <FormField label="Payload Options">
        <div className="flex flex-col gap-1.5">
          <CheckboxInput
            label="Decode Clarity values"
            checked={config.decodeClarityValues ?? true}
            onChange={(v) => onChange({ decodeClarityValues: v })}
          />
          <CheckboxInput
            label="Include raw transaction"
            checked={config.includeRawTx ?? false}
            onChange={(v) => onChange({ includeRawTx: v })}
          />
          <CheckboxInput
            label="Include block metadata"
            checked={config.includeBlockMetadata ?? true}
            onChange={(v) => onChange({ includeBlockMetadata: v })}
          />
        </div>
      </FormField>
    </>
  );
}
