# Technical Architecture: Argent Legacy Account Discovery and Upgrade

## Purpose

This CLI discovers upgradeable legacy Argent accounts from a seed phrase and performs
the upgrade workflow for the selected account. It is designed for local seed-based
discovery and uses only on-chain reads plus signed upgrade calls for the selected
account.

## High-level flow

1. Parse CLI flags and create a readline session for interactive prompts.
2. Select and validate the RPC endpoint.
3. Gather seed phrase, optional target address, and scan count.
4. Discover candidates by deriving addresses from two derivation paths and checking
   on-chain compatibility/version.
5. Show candidate list to the user and perform explicit confirmation.
6. Run upgrade flow and report either transaction hash or manual-call payload.

Entry points:

- `index.ts:main`
- `upgradeService.ts` for all on-chain reads and upgrade call construction.

## Component map

### `index.ts`

- **CLI parsing**
  - `parseCliOptions` reads flags like `--network`, `--scan-count`, `--seed-phrase`,
    `--non-interactive`, `--account-address`.
  - `printHelp` outputs usage and all supported options.

- **Output/UX helpers**
  - `color` helpers provide muted/success/warning/error output.
  - `announcePathScan` prints progress labels so scans are transparent.

- **Network selection and validation**
  - `chooseRpcUrl` handles interactive network selection and validates via
    `isRpcUrlHealthy`.
  - For `--non-interactive`, default network is Mainnet unless `--network` is set.

- **Address derivation**
  - `deriveKeyPairFromSeedPhrase` derives child keys from the seed phrase.
  - `getDefaultDerivationPaths` returns:
    - `m/44'/9004'/0'/0`
    - `m/2645'/1195502025'/1148870696'/0'/0'`
  - Legacy candidate addresses are built in
    `getOldStyleAddresses` via `getLegacyProxyAddresses` and `getDirectAddresses`.

- **Discovery**
  - `findCandidateForAddress` scans until a direct target address matches.
  - `buildCandidates` scans both paths for every account number and collects all
    upgradeable results.
  - `withTimeout` wraps RPC-heavy checks with a 12s timeout.
  - Duplicate addresses are removed with `seenAddresses`.

- **Upgrade execution orchestration**
  - `upgradeCandidate` prints account details, asks confirmation, then calls
    `upgradeOldContract` and prints either:
    - submitted tx hash, or
    - meta-transaction calldata that must be sent from a funded caller.

## Discovery logic details

For each derivation path (`new`, `old`) and each `index` from `0` to `scanCount-1`:

1. Derive private/public key from seed phrase + path + index.
2. Build all known legacy candidate addresses for that public key (`legacy proxy`
   and `direct class` variants).
3. For each candidate address:
   - Skip if already seen.
   - Call `isAccountAddressCompatible` (checks if class hash can be read).
   - Call `getAccountVersion` and unpack:
     - `OldAccountVersion`
     - `ProxyType`
     - `implementationClassHash`
   - Exclude version `v0_4_0` (already upgraded).
4. Candidate is returned (single target mode) or accumulated (full scan mode).

Important guardrails:

- Network/timeouts prevent silent hangs during slow RPC calls.
- Indexes are now surfaced as user-facing “account numbers” (`index + 1`).

## Upgrade execution logic

`upgradeOldContract` is the central dispatcher:

1. Calls `getAccountVersion` again on the chosen account.
2. Rejects already-upgraded accounts (`v0_4_0`).
3. Runs `verifyAccountOwnerAndGuardian` to enforce:
   - derived key signer must match on-chain signer
   - guardian must be zero
4. Dispatches upgrade strategy by account version:
   - `v0_2_0` / `v0_2_1` / `v0_2_2` -> `upgradeV0`
   - `v0_2_3_0` / `v0_2_3_1` -> `upgradeFrom_0_2_3`
   - `v0_3_0` / `v0_3_1` -> `upgrade_from_0_3_efo`

### `upgradeFrom_0_2_3`

- Uses `Account.execute` directly with `upgrade` entrypoint.
- Returns a real transaction hash when balance is sufficient.
- Throws when funded account can’t pay gas.

### `upgradeV0`

- Builds a proxy upgrade call (`upgrade`) and wraps it in a signed metatx payload for
  `execute_meta_tx_v0` on the `metaV0ContractAddress`.
- Returns a prepared `Call` object (`contractAddress`, `entrypoint`, `calldata`) to be
  executed via a separate funded wallet.
- Logs user steps for manual submission.

### `upgrade_from_0_3_efo`

- Builds an `OutsideExecution` message and signs typed data.
- Returns an `execute_from_outside` call payload for manual execution from a funded
  wallet.

## RPC and version constants

Most protocol constants and known implementation/class hashes are defined in
`upgradeService.ts` and include:

- `DEFAULT_MAINNET_RPC_URL`, `DEFAULT_TESTNET_RPC_URL`
- legacy implementation and proxy class hashes
- `newestReadyImplementationClassHash`

`setConfiguredRpcUrl` updates the global provider at runtime so the entire flow uses
the selected endpoint.

## Error boundaries and user protections

- `isAccountAddressCompatible` catches unsupported contracts by attempting
  `getClassHashAt` and returning `false` on failure.
- Scan and version reads are timeout-wrapped.
- CLI requires explicit `yes` confirmation before upgrade.
- In non-interactive mode, discovery is allowed but upgrade confirmation/selection is
  not performed; users are instructed to re-run interactively.

## Build and distribution model

- Development/runtime: `bun run index.ts`
- Standalone executable: `bun run build` produces `dist/argent-derive`.
- Windows users can build from Windows with:
  `bun build --compile --target=bun index.ts --outfile=dist/argent-derive.exe`
