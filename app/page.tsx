"use client";

import { useState, useCallback } from "react";
import {
  createWalletClient,
  custom,
  getAddress,
  type WalletClient,
  type Account,
  createPublicClient,
  http,
} from "viem";
import { walletClientToAccount } from "viem/accounts";
import { getContract } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { getLitClient } from "@/lib/lit";
import { encryptPassword } from "@/lib/encrypt";
import { decryptPassword } from "@/lib/decrypt";
import { createAppAuthManager, createEoaAuthContextForDecrypt } from "@/lib/auth";
import { GUARDIAN_RECOVERY_ABI } from "@/lib/contract";

const CHAIN = process.env.NEXT_PUBLIC_CHAIN === "sepolia" ? sepolia : mainnet;

export default function Home() {
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [guardians, setGuardiansState] = useState<[string, string, string]>(["", "", ""]);
  const [encryptedPayload, setEncryptedPayload] = useState<unknown>(null);
  const [decryptedSecret, setDecryptedSecret] = useState<string | null>(null);
  const [status, setStatus] = useState<{ requested: boolean; approvals: number } | null>(null);
  const [guardianList, setGuardianList] = useState<readonly [string, string, string] | null>(null);
  const [approveForOwner, setApproveForOwner] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contractAddress = process.env.NEXT_PUBLIC_RECOVERY_CONTRACT_ADDRESS;
  const hasContract = Boolean(contractAddress);

  const publicClient = createPublicClient({ chain: CHAIN, transport: http() });

  const connectWallet = useCallback(async () => {
    setError(null);
    if (typeof window === "undefined" || !window.ethereum) {
      setError("No wallet found. Install MetaMask or another Web3 wallet.");
      return;
    }
    setLoading("Connecting…");
    try {
      const client = createWalletClient({
        chain: CHAIN,
        transport: custom(window.ethereum as unknown as import("viem").EIP1193Provider),
      });
      const [addr] = await client.getAddresses();
      if (!addr) {
        setError("Could not get address. Unlock wallet and try again.");
        setLoading(null);
        return;
      }
      const acc = walletClientToAccount(client);
      setWalletClient(client);
      setAccount(acc);
      setAddress(addr);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    }
    setLoading(null);
  }, []);

  const setGuardians = useCallback(async () => {
    if (!account || !contractAddress) {
      setError("Connect wallet and set NEXT_PUBLIC_RECOVERY_CONTRACT_ADDRESS");
      return;
    }
    const [g1, g2, g3] = guardians.map((g) => getAddress(g.trim()));
    if (!g1 || !g2 || !g3) {
      setError("Enter three valid guardian addresses.");
      return;
    }
    setError(null);
    setLoading("Setting guardians…");
    try {
      const contract = getContract({
        address: contractAddress as `0x${string}`,
        abi: GUARDIAN_RECOVERY_ABI,
        client: { public: publicClient, wallet: walletClient! },
      });
      await contract.write.setGuardians([g1, g2, g3]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "setGuardians failed");
    }
    setLoading(null);
  }, [account, contractAddress, guardians, publicClient, walletClient]);

  const fetchGuardians = useCallback(async () => {
    if (!address || !contractAddress) return;
    try {
      const contract = getContract({
        address: contractAddress as `0x${string}`,
        abi: GUARDIAN_RECOVERY_ABI,
        client: publicClient,
      });
      const list = await contract.read.getGuardians([address]);
      setGuardianList(list);
    } catch {
      setGuardianList(null);
    }
  }, [address, contractAddress, publicClient]);

  const fetchStatus = useCallback(async () => {
    if (!address || !contractAddress) return;
    try {
      const contract = getContract({
        address: contractAddress as `0x${string}`,
        abi: GUARDIAN_RECOVERY_ABI,
        client: publicClient,
      });
      const [requested, approvals] = await contract.read.getRecoveryStatus([address]);
      setStatus({ requested, approvals: Number(approvals) });
    } catch {
      setStatus(null);
    }
  }, [address, contractAddress, publicClient]);

  const requestRecovery = useCallback(async () => {
    if (!walletClient || !contractAddress) {
      setError("Connect wallet and set contract address.");
      return;
    }
    setError(null);
    setLoading("Requesting recovery…");
    try {
      const contract = getContract({
        address: contractAddress as `0x${string}`,
        abi: GUARDIAN_RECOVERY_ABI,
        client: { public: publicClient, wallet: walletClient },
      });
      await contract.write.requestRecovery();
      await fetchStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "requestRecovery failed");
    }
    setLoading(null);
  }, [contractAddress, publicClient, walletClient, fetchStatus]);

  const approveRecoveryForOwner = useCallback(
    async (ownerAddress: string) => {
      if (!walletClient || !contractAddress) return;
      setError(null);
      setLoading("Approving recovery…");
      try {
        const contract = getContract({
          address: contractAddress as `0x${string}`,
          abi: GUARDIAN_RECOVERY_ABI,
          client: { public: publicClient, wallet: walletClient },
        });
        await contract.write.approveRecovery([getAddress(ownerAddress)]);
        if (ownerAddress.toLowerCase() === address?.toLowerCase()) await fetchStatus();
      } catch (e) {
        setError(e instanceof Error ? e.message : "approveRecovery failed");
      }
      setLoading(null);
    },
    [contractAddress, address, publicClient, walletClient, fetchStatus]
  );

  const [passwordToEncrypt, setPasswordToEncrypt] = useState("");
  const doEncrypt = useCallback(async () => {
    if (!passwordToEncrypt.trim() || !contractAddress) {
      setError("Enter a password and set NEXT_PUBLIC_RECOVERY_CONTRACT_ADDRESS.");
      return;
    }
    setError(null);
    setLoading("Encrypting with Lit…");
    try {
      const litClient = await getLitClient();
      const { encryptedData } = await encryptPassword(litClient, passwordToEncrypt.trim(), contractAddress);
      setEncryptedPayload(encryptedData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Encrypt failed");
    }
    setLoading(null);
  }, [passwordToEncrypt, contractAddress]);

  const doDecrypt = useCallback(async () => {
    if (!encryptedPayload || !account || !contractAddress) {
      setError("Need encrypted payload, connected wallet, and contract address.");
      return;
    }
    setError(null);
    setLoading("Decrypting (Lit checks contract)…");
    try {
      const litClient = await getLitClient();
      const authManager = createAppAuthManager();
      const authContext = await createEoaAuthContextForDecrypt(account, litClient, authManager);
      const secret = await decryptPassword(litClient, encryptedPayload, authContext, contractAddress);
      setDecryptedSecret(secret);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decrypt failed (ensure 2/3 guardians approved)");
    }
    setLoading(null);
  }, [encryptedPayload, account, contractAddress]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-semibold">Guardian recovery (Lit + contract)</h1>

        {!hasContract && (
          <p className="text-amber-400 text-sm">
            Set NEXT_PUBLIC_RECOVERY_CONTRACT_ADDRESS and optionally NEXT_PUBLIC_CHAIN (e.g. sepolia) in .env.local
          </p>
        )}

        {/* Connect */}
        <section className="rounded-lg border border-zinc-700 p-4">
          <h2 className="font-medium mb-2">Wallet</h2>
          {!address ? (
            <button
              onClick={connectWallet}
              disabled={!!loading}
              className="rounded bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading || "Connect wallet"}
            </button>
          ) : (
            <p className="text-sm text-zinc-400 break-all">{address}</p>
          )}
        </section>

        {/* Set guardians */}
        <section className="rounded-lg border border-zinc-700 p-4">
          <h2 className="font-medium mb-2">Set guardians (3 addresses, once per owner)</h2>
          <div className="grid gap-2 mb-2">
            {([0, 1, 2] as const).map((i) => (
              <input
                key={i}
                type="text"
                placeholder={`Guardian ${i + 1}`}
                value={guardians[i]}
                onChange={(e) => {
                  const next = [...guardians] as [string, string, string];
                  next[i] = e.target.value;
                  setGuardiansState(next);
                }}
                className="bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm font-mono"
              />
            ))}
          </div>
          <button
            onClick={setGuardians}
            disabled={!!loading || !address}
            className="rounded bg-zinc-600 px-3 py-2 text-sm hover:bg-zinc-500 disabled:opacity-50"
          >
            Set guardians
          </button>
          <button
            type="button"
            onClick={fetchGuardians}
            className="ml-2 rounded bg-zinc-700 px-3 py-2 text-sm hover:bg-zinc-600"
          >
            Fetch my guardians
          </button>
          {guardianList && (
            <ul className="mt-2 text-sm text-zinc-400 font-mono">
              {guardianList.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          )}
        </section>

        {/* Encrypt */}
        <section className="rounded-lg border border-zinc-700 p-4">
          <h2 className="font-medium mb-2">Encrypt password (store encrypted payload yourself)</h2>
          <input
            type="password"
            placeholder="Password to encrypt"
            value={passwordToEncrypt}
            onChange={(e) => setPasswordToEncrypt(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm mb-2"
          />
          <button
            onClick={doEncrypt}
            disabled={!!loading || !passwordToEncrypt}
            className="rounded bg-blue-600 px-3 py-2 text-sm hover:bg-blue-500 disabled:opacity-50"
          >
            Encrypt with Lit
          </button>
          {encryptedPayload && (
            <p className="mt-2 text-sm text-emerald-400">Encrypted. Use &quot;Recover password&quot; after 2/3 guardian approval.</p>
          )}
        </section>

        {/* Recovery flow */}
        <section className="rounded-lg border border-zinc-700 p-4">
          <h2 className="font-medium mb-2">Recovery flow</h2>
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              onClick={fetchStatus}
              disabled={!address}
              className="rounded bg-zinc-600 px-3 py-2 text-sm hover:bg-zinc-500 disabled:opacity-50"
            >
              Refresh status
            </button>
            <button
              onClick={requestRecovery}
              disabled={!!loading || !address}
              className="rounded bg-amber-600 px-3 py-2 text-sm hover:bg-amber-500 disabled:opacity-50"
            >
              Request recovery (owner)
            </button>
          </div>
          {status !== null && (
            <p className="text-sm text-zinc-400">
              Requested: {status.requested ? "Yes" : "No"} · Approvals: {status.approvals}/3
            </p>
          )}
          <div className="mt-2">
            <p className="text-sm text-zinc-400 mb-1">Guardian: approve recovery for an owner (enter owner address)</p>
            <input
              type="text"
              placeholder="Owner address (0x…)"
              value={approveForOwner}
              onChange={(e) => setApproveForOwner(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm font-mono mb-1"
            />
            <button
              onClick={() => approveRecoveryForOwner(approveForOwner.trim())}
              disabled={!!loading || !approveForOwner.trim()}
              className="rounded bg-zinc-600 px-3 py-2 text-sm hover:bg-zinc-500 disabled:opacity-50"
            >
              Approve recovery
            </button>
          </div>
        </section>

        {/* Decrypt */}
        <section className="rounded-lg border border-zinc-700 p-4">
          <h2 className="font-medium mb-2">Recover password (after 2/3 approval)</h2>
          <button
            onClick={doDecrypt}
            disabled={!!loading || !encryptedPayload || !account}
            className="rounded bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            Recover password
          </button>
          {decryptedSecret !== null && (
            <p className="mt-2 text-sm text-emerald-400">Decrypted: {decryptedSecret}</p>
          )}
        </section>

        {loading && <p className="text-sm text-zinc-400">{loading}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
