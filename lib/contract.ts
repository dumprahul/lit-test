export const GUARDIAN_RECOVERY_ABI = [
  {
    inputs: [
      { name: "g1", type: "address" },
      { name: "g2", type: "address" },
      { name: "g3", type: "address" },
    ],
    name: "setGuardians",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "requestRecovery",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "approveRecovery",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "recoveryApproved",
    outputs: [{ type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "getGuardians",
    outputs: [{ name: "", type: "address[3]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "getRecoveryStatus",
    outputs: [
      { name: "requested", type: "bool" },
      { name: "approvals", type: "uint8" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
