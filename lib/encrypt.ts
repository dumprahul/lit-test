import type { LitClient } from "@lit-protocol/lit-client";
import { getRecoveryAccessControlConditions, LIT_CHAIN } from "./lit";

/**
 * Encrypt a password (or any secret) with Lit.
 * The symmetric key is protected by ACC: only releasable when contract.recoveryApproved(owner) is true.
 * Store the returned encrypted payload; you will pass it to decrypt after 2/3 guardians approve.
 *
 * @param litClient - from getLitClient()
 * @param password - the secret to encrypt (e.g. user's password)
 * @param contractAddress - GuardianRecovery contract address (optional; uses env if not set)
 * @returns Encrypted data to store (you handle DB/IPFS for the ciphertext; this is the Lit encryption result)
 */
export async function encryptPassword(
  litClient: LitClient,
  password: string,
  contractAddress?: string
) {
  const contract = contractAddress ?? process.env.NEXT_PUBLIC_RECOVERY_CONTRACT_ADDRESS;
  if (!contract) throw new Error("NEXT_PUBLIC_RECOVERY_CONTRACT_ADDRESS not set");

  const unifiedAccessControlConditions = getRecoveryAccessControlConditions(contract, LIT_CHAIN);

  const encryptedData = await litClient.encrypt({
    dataToEncrypt: password,
    unifiedAccessControlConditions,
    chain: LIT_CHAIN,
  });

  return { encryptedData, unifiedAccessControlConditions };
}
