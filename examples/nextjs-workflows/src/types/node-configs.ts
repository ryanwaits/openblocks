export type TriggerMode = "live" | "single-block" | "range";

export interface EventTriggerConfig {
  triggerMode?: TriggerMode;
  startBlock?: number;
  endBlock?: number;
  singleBlock?: number;
}

export type StxEventType = "transfer" | "mint" | "burn" | "lock";

export interface StxFilterConfig {
  eventType: StxEventType;
  sender?: string;
  recipient?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface FtFilterConfig {
  assetIdentifier?: string;
  eventType: "transfer" | "mint" | "burn";
  sender?: string;
  recipient?: string;
  minAmount?: number;
}

export interface NftFilterConfig {
  assetIdentifier?: string;
  eventType: "transfer" | "mint" | "burn";
  sender?: string;
  recipient?: string;
  tokenId?: string;
}

export interface ContractCallFilterConfig {
  contractId?: string;
  functionName?: string;
  caller?: string;
}

export interface ContractDeployFilterConfig {
  deployer?: string;
  contractName?: string;
}

export interface PrintEventFilterConfig {
  contractId?: string;
  topic?: string;
  contains?: string;
}

export interface WebhookActionConfig {
  url: string;
  retryCount: number;
  includeRawTx: boolean;
  decodeClarityValues: boolean;
  includeBlockMetadata: boolean;
}

export interface NodeConfigMap {
  "event-trigger": EventTriggerConfig;
  "stx-filter": StxFilterConfig;
  "ft-filter": FtFilterConfig;
  "nft-filter": NftFilterConfig;
  "contract-call-filter": ContractCallFilterConfig;
  "contract-deploy-filter": ContractDeployFilterConfig;
  "print-event-filter": PrintEventFilterConfig;
  "webhook-action": WebhookActionConfig;
}
