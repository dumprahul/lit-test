import { nagaDev } from "@lit-protocol/networks";
import { createLitClient } from "@lit-protocol/lit-client";
import { createAccBuilder } from "@lit-protocol/access-control-conditions";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_RECOVERY_CONTRACT_ADDRESS ?? "";
const CHAIN = (process.env.NEXT_PUBLIC_CHAIN ?? "ethereum") as "ethereum" | "sepolia" | "polygon";

export const RECOVERY_CONTRACT_ADDRESS = CONTRACT_ADDRESS;
export const LIT_CHAIN = CHAIN;

/**
 * Create Lit client (Naga Dev for development - free, no payment).
 * For production use nagaTest or naga from @lit-protocol/networks.
 */
export async function getLitClient() {
  return createLitClient({ network: nagaDev });
}

/**
 * Access control: only allow decryption when the contract says recovery is approved for the requestor.
 * Lit will substitute :userAddress with the address that holds the auth context (the owner requesting recovery).
 *
 * Call this with the deployed contract address (set in NEXT_PUBLIC_RECOVERY_CONTRACT_ADDRESS).
 */
export function getRecoveryAccessControlConditions(contractAddress: string, chain: string = CHAIN) {
  const evmContractCondition = {
    conditionType: "evmContract",
    contractAddress: contractAddress.toLowerCase(),
    chain,
    functionName: "recoveryApproved",
    functionAbi: {
      name: "recoveryApproved",
      type: "function",
      inputs: [{ name: "owner", type: "address" }],
      outputs: [{ type: "bool" }],
    },
    functionParams: [":userAddress"],
    returnValueTest: {
      key: "",
      comparator: "=",
      value: "true",
    },
  };

  return createAccBuilder().unifiedAccs(evmContractCondition).build();
}
