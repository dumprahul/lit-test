"use client";

import { createAuthManager, storagePlugins } from "@lit-protocol/auth";
import type { Account } from "viem";
import type { LitClient } from "@lit-protocol/lit-client";

const APP_NAME = "lit-guardian-recovery";
const NETWORK_NAME = "naga-dev";

/**
 * Create auth manager (browser localStorage). Use in client components only.
 */
export function createAppAuthManager() {
  if (typeof window === "undefined") {
    throw new Error("createAppAuthManager must be called in the browser");
  }
  return createAuthManager({
    storage: storagePlugins.localStorage({
      appName: APP_NAME,
      networkName: NETWORK_NAME,
    }),
  });
}

/**
 * Create EOA auth context for the owner so they can decrypt after 2/3 guardian approval.
 * Uses the connected wallet account; Lit will use this address as :userAddress when checking recoveryApproved(owner).
 */
export async function createEoaAuthContextForDecrypt(
  account: Account,
  litClient: LitClient,
  authManager: ReturnType<typeof createAuthManager>
) {
  return authManager.createEoaAuthContext({
    config: { account },
    authConfig: {
      domain: typeof window !== "undefined" ? window.location.host : "localhost",
      statement: "Decrypt recovery secret",
      expiration: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      resources: [
        ["access-control-condition-decryption", "*"],
        ["lit-action-execution", "*"],
      ],
    },
    litClient,
  });
}
