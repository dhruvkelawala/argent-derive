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
   - `argent-derive-macos-arm64` (Apple Silicon)
   - `argent-derive-macos-x64` (Intel)
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

### Running downloaded release binaries

When users download a release binary, they should run it from a terminal.

On macOS:

```bash
chmod +x argent-derive-macos-<arch>
./argent-derive-macos-<arch>
```

Use your CPU architecture:

- `argent-derive-macos-x64` for Intel Macs
- `argent-derive-macos-arm64` for Apple Silicon

If your seed phrase contains spaces, use quotes:

```bash
./argent-derive-macos-arm64 --seed-phrase "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
```

On Windows (PowerShell):

```powershell
.\argent-derive-windows-x64.exe
```

On Windows (non-interactive mode from CI/automation):

```powershell
.\argent-derive-windows-x64.exe --non-interactive --network mainnet --seed-phrase "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about" --scan-count 1 --no-color
```

Tip: if you double-click the binary instead of running it in a terminal, the tool may exit immediately and prompts may not appear.

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
