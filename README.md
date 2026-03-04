# argent-derive

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

To build a standalone executable:

```bash
bun run build
./dist/argent-derive
```

Or install it globally from the source folder:

```bash
cp ./dist/argent-derive /usr/local/bin/argent-derive
argent-derive --help
```

### Release binaries

Use GitHub Releases for users who do not have Bun installed:

1. Tag a release:

   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. The CI workflow builds Linux, macOS, and Windows binaries and publishes them to
   the GitHub release automatically.

3. Users can download and run the correct executable from the release page:

   - `argent-derive-linux-x64`
   - `argent-derive-macos-x64`
   - `argent-derive-windows-x64.exe`

The CLI now lets you:

- enter a seed phrase
- optionally enter a specific account address to upgrade directly
- scan both Argent derivation paths
- auto-detect upgradable legacy accounts in an account number range
- select one account and start the matching upgrade flow

Quick start:

- Run the tool: `bun run index.ts`
- Choose network:
  - `1` for Mainnet (default)
  - `2` for Testnet
  - `3` for custom RPC (advanced users)
- Paste your seed phrase when prompted
- Leave account address empty to scan all candidates, or paste one address to target a single account
- Enter how many account numbers to check per path (for example `10`)
- Pick the account number from the list and confirm with `yes` to upgrade

Non-interactive / CI mode:

```bash
bun run index.ts --non-interactive --network mainnet --seed-phrase "your twelve or twenty-four words" --scan-count 1 --no-color
```

Useful flags:

- `--no-color`: disables ANSI color output (helpful for automation)
- `--non-interactive`: skips prompts (requires `--seed-phrase`)
- `--network mainnet|testnet|custom`: preselect network
- `--rpc-url <url>`: set RPC URL (recommended with `--network custom`)
- `--account-address <address>`: target one address instead of full candidate list

At startup, the tool now asks which Starknet network to use:

- Mainnet (default)
- Testnet
- Custom RPC URL (advanced users)

Scanning does per-address on-chain checks, so it can take a bit of time on larger ranges (for example, a few seconds per account number).
You can lower `How many account numbers should be checked per path` when you want a fast check.

Environment variables:

- `RPC_URL`: optional RPC endpoint used as the default when you select the custom URL and leave it blank.

Technical docs:

- [Detailed architecture and upgrade flow](./TECHNICAL.md)

This project was created using `bun init` in bun v1.0.0. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
