import type { LitClient } from "@lit-protocol/lit-client";
import { getRecoveryAccessControlConditions, LIT_CHAIN } from "./lit";

/** EOA auth context from createEoaAuthContext (chain, sessionKeyPair, authNeededCallback, authConfig, etc.) */
export type EoaAuthContext = Parameters<LitClient["decrypt"]>[0]["authContext"];

/**
 * Decrypt the password after 2/3 guardians have approved recovery.
 * The owner must call this with their EOA auth context (the same address that requested recovery).
 * Lit will check the contract's recoveryApproved(owner); if true, it releases the key and decrypts.
 *
 * @param litClient - from getLitClient()
 * @param encryptedData - the payload returned from encryptPassword (has ciphertext, dataToEncryptHash, metadata)
 * @param authContext - EOA auth context for the owner (requestor)
 * @param contractAddress - GuardianRecovery contract address (optional)
 * @returns Decrypted password string
 */
export async function decryptPassword(
  litClient: LitClient,
  encryptedData: unknown,
  authContext: EoaAuthContext,
  contractAddress?: string
): Promise<string> {
  const contract = contractAddress ?? process.env.NEXT_PUBLIC_RECOVERY_CONTRACT_ADDRESS;
  if (!contract) throw new Error("NEXT_PUBLIC_RECOVERY_CONTRACT_ADDRESS not set");

  const unifiedAccessControlConditions = getRecoveryAccessControlConditions(contract, LIT_CHAIN);

  const decrypted = await litClient.decrypt({
    data: encryptedData as Parameters<LitClient["decrypt"]>[0] extends { data: infer D } ? D : never,
    unifiedAccessControlConditions,
    authContext,
    chain: LIT_CHAIN,
  });

  if (typeof decrypted.decryptedData !== "string") {
    throw new Error("Decrypted data is not a string");
  }
  return decrypted.decryptedData;
}
