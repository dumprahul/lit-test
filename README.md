# Guardian recovery (Lit + contract)

Encrypt a password with [Lit Protocol](https://developer.litprotocol.com/sdk/getting-started/lit-client); the key is only releasable when a smart contract reports that 2/3 guardians have approved recovery for the owner.

## Workflow

1. **Owner** sets 3 guardian addresses (once) and encrypts their password with Lit. Encrypted payload is stored by you (DB/IPFS later).
2. **Forgot password:** Owner requests recovery on-chain. Any 2 of 3 guardians call `approveRecovery(owner)`.
3. When `recoveryApproved(owner)` is `true`, Lit’s access control allows decryption. Owner connects the same wallet and clicks “Recover password” to decrypt.

## Setup

1. **Deploy the contract**  
   Use the Solidity in `contracts/GuardianRecovery.sol`. Deploy to your chain (e.g. Ethereum, Sepolia).

2. **Env**  
   Copy `.env.local.example` to `.env.local` and set:
   - `NEXT_PUBLIC_RECOVERY_CONTRACT_ADDRESS` – deployed `GuardianRecovery` address  
   - `NEXT_PUBLIC_CHAIN` – e.g. `ethereum` or `sepolia` (for contract + Lit ACC)

3. **Install and run**
   ```bash
   npm install
   npm run dev
   ```

## Access control in Lit

Decryption is gated by an **EVM contract condition**: Lit calls `recoveryApproved(address)` on your contract with the requestor’s address (`:userAddress`). Decryption is allowed only when that returns `true` (i.e. 2/3 guardians have approved). Use the same contract address in `getRecoveryAccessControlConditions()` in `lib/lit.ts` (it reads `NEXT_PUBLIC_RECOVERY_CONTRACT_ADDRESS`).

## Contract summary

- **setGuardians(g1, g2, g3)** – Call once per owner to set 3 guardians.
- **requestRecovery()** – Owner requests recovery.
- **approveRecovery(owner)** – Guardian approves for that owner.
- **recoveryApproved(owner)** – View: `true` when recovery was requested and ≥2 guardians have approved. Lit ACC uses this.
