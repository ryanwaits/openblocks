import { createContext, useContext, type ReactNode } from "react";
import { createElement } from "react";
import type { LivelyClient } from "@waits/lively-client";

const ClientContext = createContext<LivelyClient | null>(null);

export interface LivelyProviderProps {
  /** Shared `LivelyClient` instance — create once at module level */
  client: LivelyClient;
  children: ReactNode;
}

/**
 * Top-level provider that makes an `LivelyClient` available to all
 * nested hooks. Create the client once at module level and pass it here.
 *
 * @example
 * const client = new LivelyClient({ serverUrl: "ws://localhost:2001" });
 * <LivelyProvider client={client}>
 *   <App />
 * </LivelyProvider>
 */
export function LivelyProvider({ client, children }: LivelyProviderProps): ReactNode {
  return createElement(ClientContext.Provider, { value: client }, children);
}

/**
 * Returns the `LivelyClient` from context. Must be inside `<LivelyProvider>`.
 * Throws if called outside a provider.
 */
export function useClient(): LivelyClient {
  const client = useContext(ClientContext);
  if (!client) {
    throw new Error("useClient must be used within an <LivelyProvider>");
  }
  return client;
}
