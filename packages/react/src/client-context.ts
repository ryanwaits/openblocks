import { createContext, useContext, type ReactNode } from "react";
import { createElement } from "react";
import type { OpenBlocksClient } from "@waits/openblocks-client";

const ClientContext = createContext<OpenBlocksClient | null>(null);

export interface OpenBlocksProviderProps {
  /** Shared `OpenBlocksClient` instance — create once at module level */
  client: OpenBlocksClient;
  children: ReactNode;
}

/**
 * Top-level provider that makes an `OpenBlocksClient` available to all
 * nested hooks. Create the client once at module level and pass it here.
 *
 * @example
 * const client = new OpenBlocksClient({ serverUrl: "ws://localhost:2001" });
 * <OpenBlocksProvider client={client}>
 *   <App />
 * </OpenBlocksProvider>
 */
export function OpenBlocksProvider({ client, children }: OpenBlocksProviderProps): ReactNode {
  return createElement(ClientContext.Provider, { value: client }, children);
}

/**
 * Returns the `OpenBlocksClient` from context. Must be inside `<OpenBlocksProvider>`.
 * Throws if called outside a provider.
 */
export function useClient(): OpenBlocksClient {
  const client = useContext(ClientContext);
  if (!client) {
    throw new Error("useClient must be used within an <OpenBlocksProvider>");
  }
  return client;
}
