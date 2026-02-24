"use client";

import type { WebhookActionConfig } from "@/types/node-configs";
import { FormField, TextInput, NumberInput, CheckboxInput } from "./form-field";

export function WebhookActionForm({
  config,
  onChange,
  boardId,
  workflowId,
}: {
  config: WebhookActionConfig;
  onChange: (c: Partial<WebhookActionConfig>) => void;
  boardId: string;
  workflowId: string;
}) {
  const defaultUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/${workflowId}`;

  return (
    <>
      <FormField label="Webhook URL">
        <TextInput
          value={config.url ?? ""}
          onChange={(v) => onChange({ url: v })}
          placeholder={defaultUrl}
        />
        <p className="mt-1 break-all text-[10px] text-gray-400">{defaultUrl}</p>
        {config.url && config.url !== defaultUrl && (
          <button
            type="button"
            onClick={() => onChange({ url: defaultUrl })}
            className="mt-1 text-[11px] font-medium text-blue-500 hover:text-blue-600"
          >
            Reset to default
          </button>
        )}
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
