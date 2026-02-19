import { createContext, useContext, type ReactNode } from "react";
import { createElement } from "react";
import type { OpenBlocksClient } from "@waits/openblocks-client";

const ClientContext = createContext<OpenBlocksClient | null>(null);

export interface OpenBlocksProviderProps {
  client: OpenBlocksClient;
  children: ReactNode;
}

export function OpenBlocksProvider({ client, children }: OpenBlocksProviderProps) {
  return createElement(ClientContext.Provider, { value: client }, children);
}

export function useClient(): OpenBlocksClient {
  const client = useContext(ClientContext);
  if (!client) {
    throw new Error("useClient must be used within an <OpenBlocksProvider>");
  }
  return client;
}
