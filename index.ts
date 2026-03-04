import { createInterface } from "node:readline";
import { basename } from "node:path";
import { hexToBytes } from "@noble/hashes/utils";
import { HDKey } from "@scure/bip32";
import { CallData, ec, encode, hash, num } from "starknet";
import { HDNodeWallet } from "ethers";
import {
  DEFAULT_MAINNET_RPC_URL,
  DEFAULT_TESTNET_RPC_URL,
  getAccountVersion,
  getAccountVersionLabel,
  v0_2_0_implementationClassHash,
  v0_2_1_implementationClassHash,
  v0_2_2_implementationClassHash,
  v0_2_3_0_implementationClassHash,
  v0_2_3_1_implementationClassHash,
  v0_2_0_proxyClassHash,
  v0_3_0_implementationClassHash,
  v0_3_1_implementationClassHash,
  v0_4_0_implementationClassHash,
  isRpcUrlHealthy,
  getDefaultDerivationPaths,
  getProxyTypeLabel,
  isAccountAddressCompatible,
  OldAccountVersion,
  ProxyType,
  upgradeOldContract,
  setConfiguredRpcUrl,
} from "./upgradeService";

type NetworkOption = "mainnet" | "testnet" | "custom";

interface CliOptions {
  noColor: boolean;
  nonInteractive: boolean;
  network?: NetworkOption;
  rpcUrl?: string;
  seedPhrase?: string;
  accountAddress?: string;
  scanCount?: number;
  help: boolean;
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    noColor: false,
    nonInteractive: false,
    help: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--no-color") {
      options.noColor = true;
      continue;
    }
    if (arg === "--non-interactive") {
      options.nonInteractive = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--network") {
      const value = args[i + 1];
      if (!value || (value !== "mainnet" && value !== "testnet" && value !== "custom")) {
        throw new Error("--network must be one of: mainnet, testnet, custom");
      }
      options.network = value;
      i += 1;
      continue;
    }
    if (arg === "--rpc-url") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("--rpc-url requires a value");
      }
      options.rpcUrl = value;
      i += 1;
      continue;
    }
    if (arg === "--seed-phrase") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("--seed-phrase requires a value");
      }
      options.seedPhrase = value;
      i += 1;
      continue;
    }
    if (arg === "--account-address") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("--account-address requires a value");
      }
      options.accountAddress = value;
      i += 1;
      continue;
    }
    if (arg === "--scan-count") {
      const value = args[i + 1];
      const parsed = Number.parseInt(value || "", 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("--scan-count must be a positive integer");
      }
      options.scanCount = parsed;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  const sourceArg = process.argv[1] ?? "";
  const invocation = sourceArg.endsWith(".ts") ? "bun run index.ts" : basename(sourceArg);
  console.log(`Usage: ${invocation} [options]`);
  console.log("\nOptions:");
  console.log("  --no-color                    Disable colored output");
  console.log("  --non-interactive             Run without prompts (requires --seed-phrase)");
  console.log("  --network <mainnet|testnet|custom>");
  console.log("  --rpc-url <url>               RPC URL (recommended with --network custom)");
  console.log("  --seed-phrase \"...\"          Seed phrase to use");
  console.log("  --account-address <address>   Optional target address");
  console.log("  --scan-count <number>         Account numbers to check per path");
  console.log("  --help, -h                    Show this help");
}

const cliOptions = parseCliOptions(process.argv.slice(2));

const useColor = process.stdout.isTTY === true && !cliOptions.noColor;

const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

const color = {
  heading: (text: string) => (useColor ? `${ansi.bold}${ansi.cyan}${text}${ansi.reset}` : text),
  success: (text: string) => (useColor ? `${ansi.green}${text}${ansi.reset}` : text),
  muted: (text: string) => (useColor ? `${ansi.dim}${text}${ansi.reset}` : text),
  warning: (text: string) => (useColor ? `${ansi.yellow}${text}${ansi.reset}` : text),
  error: (text: string) => (useColor ? `${ansi.red}${text}${ansi.reset}` : text),
};

interface DerivedAccountCandidate {
  address: string;
  index: number;
  derivationPath: string;
  privateKey: string;
  publicKey: string;
  source: string;
  version: OldAccountVersion;
  proxyType: ProxyType;
  implementationClassHash: string;
}

const { newPath: NEW_DERIVATION_PATH, oldPath: OLD_DERIVATION_PATH } =
  getDefaultDerivationPaths();

const v2ImplementationHashes = [
  v0_2_0_implementationClassHash,
  v0_2_1_implementationClassHash,
  v0_2_2_implementationClassHash,
  v0_2_3_0_implementationClassHash,
  v0_2_3_1_implementationClassHash,
];

const v2LegacyProxyClassHash = v0_2_0_proxyClassHash;

const directClassHashes = [
  v0_2_0_implementationClassHash,
  v0_2_1_implementationClassHash,
  v0_2_2_implementationClassHash,
  v0_2_3_0_implementationClassHash,
  v0_2_3_1_implementationClassHash,
  v0_3_0_implementationClassHash,
  v0_3_1_implementationClassHash,
  v0_4_0_implementationClassHash,
];

function createQuestioner() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return {
    ask: (text: string): Promise<string> =>
      new Promise((resolve) => {
        rl.question(text, (answer) => {
          resolve((answer ?? "").trim());
        });
      }),
    close: () => rl.close(),
  };
}

function formatChainHealthMessage(chainId: string): string {
  return chainId;
}

function announcePathScan(label: string, scanCount: number) {
  console.log(`\nScanning derivation path: ${label}`);
  console.log(`  Checking account numbers 1 to ${scanCount}...`);
  console.log(color.muted(`  This can take a little while on network checks, one account number at a time.`));
}

async function chooseRpcUrl(ask?: (text: string) => Promise<string>) {
  const envUrl = process.env.RPC_URL?.trim();

  if (cliOptions.nonInteractive && !cliOptions.network) {
    const health = await isRpcUrlHealthy(DEFAULT_MAINNET_RPC_URL);
    if (!health.ok) {
      throw new Error(`Could not connect to selected network: ${health.error}`);
    }
    console.log(color.success(`\nConnected to Mainnet network.`));
    console.log(color.muted(`Chain ID: ${formatChainHealthMessage(health.chainId)}`));
    setConfiguredRpcUrl(DEFAULT_MAINNET_RPC_URL);
    return DEFAULT_MAINNET_RPC_URL;
  }

  if (cliOptions.network) {
    const selectedUrl =
      cliOptions.network === "mainnet"
        ? DEFAULT_MAINNET_RPC_URL
        : cliOptions.network === "testnet"
          ? DEFAULT_TESTNET_RPC_URL
          : (cliOptions.rpcUrl || envUrl || "").trim();

    if (!selectedUrl) {
      throw new Error("Custom network requires --rpc-url or RPC_URL");
    }

    const health = await isRpcUrlHealthy(selectedUrl);
    if (!health.ok) {
      throw new Error(`Could not connect to selected network: ${health.error}`);
    }

    const networkName = cliOptions.network[0].toUpperCase() + cliOptions.network.slice(1);
    console.log(color.success(`\nConnected to ${networkName} network.`));
    console.log(color.muted(`Chain ID: ${formatChainHealthMessage(health.chainId)}`));
    setConfiguredRpcUrl(selectedUrl);
    return selectedUrl;
  }

  while (true) {
    if (!ask) {
      throw new Error("Interactive prompt is unavailable");
    }
    const selection = (
      await ask(
        `${color.heading("\nFirst, choose a network\n")}  1) Starknet Mainnet\n` +
          `  2) Starknet Testnet\n` +
          "  3) Use a custom RPC URL (advanced)\n" +
          color.muted("Choose one option [1]: "),
      )
    ).trim();

    const option = selection || "1";

    let selectedUrl = "";
    if (option === "1") {
      selectedUrl = DEFAULT_MAINNET_RPC_URL;
    } else if (option === "2") {
      selectedUrl = DEFAULT_TESTNET_RPC_URL;
    } else if (option === "3") {
      const customPrompt = envUrl
        ? `Enter RPC URL [blank = ${envUrl || ""}]: `
        : "Enter RPC URL: ";
      const custom = (await ask(customPrompt)).trim();
      selectedUrl = custom || envUrl || "";

      if (!selectedUrl) {
        console.log(color.warning("A custom RPC URL is required."));
        continue;
      }
    } else {
      console.log(color.error("Invalid selection. Please choose 1, 2, or 3."));
      continue;
    }

    const health = await isRpcUrlHealthy(selectedUrl);
    if (!health.ok) {
      console.log(color.error(`\nCould not connect to that network.`));
      console.log(color.muted(`Error: ${health.error}`));
      continue;
    }

    const networkName = option === "1" ? "Mainnet" : option === "2" ? "Testnet" : "custom";
    console.log(color.success(`\nConnected to ${networkName} network.`));
    console.log(color.muted(`Chain ID: ${formatChainHealthMessage(health.chainId)}`));
    setConfiguredRpcUrl(selectedUrl);
    return selectedUrl;
  }
}

function deriveKeyPair(secret: string, derivationPath: string, index: number) {
  const hex = encode.removeHexPrefix(num.toHex(secret));
  const sanitized = encode.sanitizeBytes(hex, 2);
  const masterNode = HDKey.fromMasterSeed(hexToBytes(sanitized));

  const derivationPathWithIndex = `${derivationPath}/${index}`;
  const childNode = masterNode.derive(derivationPathWithIndex);

  if (!childNode.privateKey) {
    throw new Error("childNode.privateKey is undefined");
  }

  const groundKey = ec.starkCurve.grindKey(childNode.privateKey);

  return {
    pk: encode.addHexPrefix(groundKey),
    pubKey: encode.sanitizeHex(ec.starkCurve.getStarkKey(groundKey)),
  };
}

function deriveKeyPairFromSeedPhrase(
  seedPhrase: string,
  derivationPath: string,
  index: number,
) {
  const ethersWallet = HDNodeWallet.fromPhrase(seedPhrase);
  return deriveKeyPair(ethersWallet.privateKey, derivationPath, index);
}

function getLegacyProxyAddresses(pubKey: string): string[] {
  return v2ImplementationHashes.map((implementation) => {
    const constructorCalldata = CallData.compile({
      implementation,
      selector: hash.getSelectorFromName("initialize"),
      calldata: CallData.compile({ signer: pubKey, guardian: "0" }),
    });

    return hash.calculateContractAddressFromHash(
      pubKey,
      v2LegacyProxyClassHash,
      constructorCalldata,
      0,
    );
  });
}

function getDirectAddresses(pubKey: string): string[] {
  return directClassHashes.map((classHash) => {
    const constructorCalldata = CallData.compile({
      signer: pubKey,
      guardian: "0",
    });

    return hash.calculateContractAddressFromHash(
      pubKey,
      classHash,
      constructorCalldata,
      0,
    );
  });
}

function getOldStyleAddresses(pubKey: string) {
  const legacy = getLegacyProxyAddresses(pubKey).map((address) => ({
    source: "legacy v0.2 proxy",
    address,
  }));

  const direct = getDirectAddresses(pubKey).map((address) => ({
    source: "direct account class",
    address,
  }));

  const uniqueByAddress = new Map<string, string>();

  for (const candidate of [...legacy, ...direct]) {
    uniqueByAddress.set(candidate.address, candidate.source);
  }

  return Array.from(uniqueByAddress, ([address, source]) => ({ address, source }));
}

function normalizeAddress(address: string): string {
  return num.toHex(address).toLowerCase();
}

async function withTimeout<T>(value: Promise<T>, timeoutMs: number, context: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`${context} timed out after ${timeoutMs}ms`)), timeoutMs),
  );
  return Promise.race([value, timeout]);
}

const RPC_CALL_TIMEOUT_MS = 12_000;

async function findCandidateForAddress(
  seedPhrase: string,
  targetAddress: string,
  scanCount: number,
): Promise<DerivedAccountCandidate | null> {
  const target = normalizeAddress(targetAddress);
  const logger = { log: () => {} };
  const derivationPaths = [
    { label: "new", path: NEW_DERIVATION_PATH },
    { label: "old", path: OLD_DERIVATION_PATH },
  ];

  for (const { label, path } of derivationPaths) {
    announcePathScan(label, scanCount);
    for (let index = 0; index < scanCount; index += 1) {
      const accountNumber = index + 1;
      console.log(`  - checking account #${accountNumber}`);
      const { pk, pubKey } = deriveKeyPairFromSeedPhrase(seedPhrase, path, index);
      const potentialAddresses = getOldStyleAddresses(pubKey);

      for (const { address, source } of potentialAddresses) {
        if (normalizeAddress(address) !== target) {
          continue;
        }

        let compatible = false;
        try {
          compatible = await withTimeout(
            isAccountAddressCompatible(address),
            RPC_CALL_TIMEOUT_MS,
            `address compatibility check for ${address}`,
          );
        } catch {
          continue;
        }
        if (!compatible) {
          return null;
        }

        try {
          const [version, proxyType, implementationClassHash] = await withTimeout(
            getAccountVersion(logger, address),
            RPC_CALL_TIMEOUT_MS,
            `account version check for ${address}`,
          );

          if (version === OldAccountVersion.v0_4_0) {
            return null;
          }

          return {
            address,
            index,
            derivationPath: path,
            privateKey: pk,
            publicKey: pubKey,
            source: `${label} derivation path (${source})`,
            version,
            proxyType,
            implementationClassHash,
          };
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

async function upgradeCandidate(
  chosen: DerivedAccountCandidate,
  ask: (text: string) => Promise<string>,
) {
  console.log(`\n${color.heading("Preparing upgrade")}`);
  console.log(`Account: ${chosen.address}`);
  console.log(`Derivation path: ${chosen.derivationPath}`);
  console.log(`Account number: ${chosen.index + 1}`);
  console.log(`Source: ${chosen.source}`);
  console.log(`Public key: ${chosen.publicKey}`);
  console.log(`Implementation hash: ${chosen.implementationClassHash}`);

  console.log(color.warning("\nImportant: this will upgrade the account contract for this account."));
  console.log("What this means: your account logic changes to the latest compatible Argent version,");
  console.log("but the account address stays the same. This is usually not reversible.");
  console.log("Do this only if this is really your account and you want to migrate it now.");

  const confirm = await ask(color.muted("Type 'yes' to continue or anything else to cancel: "));
  if (confirm.toLowerCase() !== "yes") {
    console.log(color.warning("\nUpgrade canceled by user."));
    return;
  }

  const result = await upgradeOldContract(
    { log: (...args: unknown[]) => console.log(...args) },
    chosen.address,
    chosen.privateKey,
  );

  if (result === null) {
    console.log(color.success("\nAccount is already at latest version."));
    return;
  }

  if (typeof result === "string") {
    console.log(`\nUpgrade transaction submitted: ${result}`);
    console.log(`Track: https://voyager.online/tx/${result}`);
    return;
  }

  console.log(color.warning("\nUpgrade requires a separate funded wallet to submit this call."));
  console.log(`Contract: ${result.contractAddress}`);
  console.log(`Entry point: ${result.entrypoint}`);
  console.log(`Call data:\n${JSON.stringify(result.calldata, null, 2)}`);
}

async function buildCandidates(seedPhrase: string, scanCount: number) {
  const candidates: DerivedAccountCandidate[] = [];
  const logger = { log: () => {} };
  const seenAddresses = new Set<string>();
  const derivationPaths = [
    { label: "new", path: NEW_DERIVATION_PATH },
    { label: "old", path: OLD_DERIVATION_PATH },
  ];

  for (const { label, path } of derivationPaths) {
    announcePathScan(label, scanCount);
    for (let index = 0; index < scanCount; index += 1) {
      const accountNumber = index + 1;
      console.log(`  - checking account #${accountNumber}`);
      const { pk, pubKey } = deriveKeyPairFromSeedPhrase(seedPhrase, path, index);
      const potentialAddresses = getOldStyleAddresses(pubKey);

      for (const { address, source } of potentialAddresses) {
        if (seenAddresses.has(address)) {
          continue;
        }

        let compatible = false;
        try {
          compatible = await withTimeout(
            isAccountAddressCompatible(address),
            RPC_CALL_TIMEOUT_MS,
            `address compatibility check for ${address}`,
          );
        } catch {
          continue;
        }
        if (!compatible) {
          continue;
        }

        try {
          const [version, proxyType, implementationClassHash] = await withTimeout(
            getAccountVersion(logger, address),
            RPC_CALL_TIMEOUT_MS,
            `account version check for ${address}`,
          );

          if (version === OldAccountVersion.v0_4_0) {
            continue;
          }

          seenAddresses.add(address);
          candidates.push({
            address,
            index,
            derivationPath: path,
            privateKey: pk,
            publicKey: pubKey,
            source: `${label} derivation path (${source})`,
            version,
            proxyType,
            implementationClassHash,
          });
        } catch {
          continue;
        }
      }
    }
  }

  return candidates;
}

function formatCandidateLine(candidate: DerivedAccountCandidate, i: number) {
  return `${i + 1}. ${candidate.address} | ${getAccountVersionLabel(candidate.version)} / ${getProxyTypeLabel(candidate.proxyType)} | ${candidate.source} | account #${candidate.index + 1} | path ${candidate.derivationPath} | pub ${candidate.publicKey}`;
}

async function main() {
  if (cliOptions.help) {
    printHelp();
    return;
  }

  if (cliOptions.nonInteractive && !cliOptions.seedPhrase) {
    throw new Error("--non-interactive requires --seed-phrase");
  }

  const needsPrompt =
    !cliOptions.nonInteractive &&
    (!cliOptions.seedPhrase || cliOptions.accountAddress === undefined || cliOptions.scanCount === undefined);

  const questioner = needsPrompt ? createQuestioner() : null;
  const ask = questioner?.ask;

  try {
    await chooseRpcUrl(ask);

    const seedPhrase = cliOptions.seedPhrase || (ask ? await ask(color.muted("Seed phrase: ")) : "");
    if (!seedPhrase) {
      throw new Error("Seed phrase is required");
    }

    const directAddress =
      cliOptions.accountAddress ||
      (ask
        ? await ask(color.muted("Account address (optional, leave blank to scan for matching accounts): "))
        : "");

    const countInput =
      cliOptions.scanCount === undefined
        ? ask
          ? await ask(color.muted("How many account numbers should be checked per path [10]: "))
          : "10"
        : `${cliOptions.scanCount}`;
    const scanCount = Number.parseInt(countInput || "10", 10);
    if (!Number.isFinite(scanCount) || scanCount <= 0) {
      throw new Error("Invalid count");
    }

    if (directAddress) {
      const chosen = await findCandidateForAddress(seedPhrase, directAddress, scanCount);
      if (!chosen) {
        console.log(
          color.warning(`\nCould not find an upgradable legacy account for that address in scanned range.`),
        );
        console.log(
          color.muted("Try increasing the account number count or check if the address is already up to date."),
        );
        return;
      }

      if (!ask) {
        console.log(color.warning("Candidate found, but upgrade confirmation requires interactive mode."));
        console.log(color.muted("Re-run without --non-interactive to continue the upgrade."));
        return;
      }

      await upgradeCandidate(chosen, ask);
      return;
    }

    console.log(`\n${color.heading(`Scanning first ${scanCount} accounts on each path...`)}`);
    const candidates = await buildCandidates(seedPhrase, scanCount);

    if (candidates.length === 0) {
      console.log(color.muted("No upgradable legacy accounts found for this scan."));
      return;
    }

    console.log(color.success(`\nFound ${candidates.length} upgradable candidate account(s):\n`));
    candidates.forEach((candidate, i) => {
      console.log(formatCandidateLine(candidate, i));
    });

    if (!ask) {
      console.log(color.warning("Candidates found, but selection and confirmation require interactive mode."));
      console.log(color.muted("Re-run without --non-interactive to pick and upgrade an account."));
      return;
    }

    const selectedInput = await ask(color.muted("Choose an account to upgrade (number): "));
    const selectedNumber = Number.parseInt(selectedInput, 10);
    if (
      !Number.isInteger(selectedNumber) ||
      selectedNumber < 1 ||
      selectedNumber > candidates.length
    ) {
      throw new Error("Invalid account selection");
    }

    const chosen = candidates[selectedNumber - 1];
    await upgradeCandidate(chosen, ask);
  } finally {
    questioner?.close();
  }
}

void main();
