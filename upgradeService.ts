import {
  Account,
  Call,
  CallData,
  Contract,
  RawArgs,
  Signer,
  RpcProvider,
  BigNumberish,
  num,
  hash,
  ec,
  constants,
  selector,
  shortString,
  v2hash,
  typedData,
  stark,
} from "starknet";

function normalizeHex(value: string): string {
  return num.toHex(value);
}

export const DEFAULT_MAINNET_RPC_URL = "https://rpc.starknet.lava.build:443";
export const DEFAULT_TESTNET_RPC_URL = "https://rpc.starknet-testnet.lava.build:443";

const configuredUrl = process.env.RPC_URL || DEFAULT_MAINNET_RPC_URL;

export let provider = new RpcProvider({ nodeUrl: configuredUrl });

interface RpcHealthCheckResultSuccess {
  ok: true;
  chainId: string;
}

interface RpcHealthCheckResultFailure {
  ok: false;
  error: string;
}

export type RpcHealthCheckResult = RpcHealthCheckResultSuccess | RpcHealthCheckResultFailure;

export function setConfiguredRpcUrl(rpcUrl: string) {
  provider = new RpcProvider({ nodeUrl: rpcUrl });
}

export async function isRpcUrlHealthy(rpcUrl: string): Promise<RpcHealthCheckResult> {
  const testProvider = new RpcProvider({ nodeUrl: rpcUrl });
  try {
    const chainId = `${await testProvider.getChainId()}`;
    return {
      ok: true,
      chainId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : `${error}`,
    };
  }
}

export const v0_4_0_implementationClassHash = num.toHex(
  "0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f",
);
export const v0_4_0_implementationAddress = num.toHex(
  "0x0205b9e3a6c1c8b356b93fe1bcf254831f6b7e9de51eb7d8c7eb86b6aa2b6f97",
);

export const v0_3_1_implementationClassHash = num.toHex(
  "0x029927c8af6bccf3f6fda035981e765a7bdbf18a2dc0d630494f8758aa908e2b",
);
export const v0_3_1_implementationAddress = num.toHex(
  "0x0374a07a301753a7ac26236b9c8d6fdd8056ab58fbca7764415e2e3be39bc259",
);

export const v0_3_0_implementationClassHash = num.toHex(
  "0x1a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003",
);
export const v0_3_0_implementationAddress = num.toHex(
  "0x01d731eb37f5fa1816994840b8a9cfde028b092d29e36d14cedcccfa915f5fdc",
);

export const v0_2_3_1_implementationClassHash = num.toHex(
  "0x33434ad846cdd5f23eb73ff09fe6fddd568284a0fb7d1be20ee482f044dabe2",
);
export const v0_2_3_1_implementationAddress = num.toHex(
  "0x014297b4d1d302438fc420f7983e78541af79de07aa1f0c4b168d80dbf909d5e",
);

export const v0_2_3_0_implementationClassHash = num.toHex(
  "0x01a7820094feaf82d53f53f214b81292d717e7bb9a92bb2488092cd306f3993f",
);
export const v0_2_3_0_implementationAddress = num.toHex(
  "0x02ebbf2ec2065b4c5f89549b197b522d928d53ef3af2e48947a41dc1fe8a300a",
);

export const v0_2_2_implementationAddress = num.toHex(
  "0x054e493609b9a31e53a64b25e2f1fc96f6b21152c05c7348a0785435cc298a38",
);
export const v0_2_2_implementationClassHash = num.toHex(
  "0x3e327de1c40540b98d05cbcb13552008e36f0ec8d61d46956d2f9752c294328",
);

export const v0_2_2_proxyClassHash = num.toHex(
  "0x25ec026985a3bf9d0cc1fe17326b245dfdc3ff89b8fde106542a3ea56c5a918",
);

export const v0_2_1_implementationAddress = num.toHex(
  "0x1bd7ca87f139693e6681be2042194cf631c4e8d77027bf0ea9e6d55fc6018ac",
);
export const v0_2_1_implementationClassHash = num.toHex(
  "0x6a1776964b9f991c710bfe910b8b37578b32b26a7dffd1669a1a59ac94bf82f",
);

export const v0_2_0_implementationAddress = num.toHex(
  "0x5f28c66afd8a6799ddbe1933bce2c144625031aafa881fa38fa830790eff204",
);
export const v0_2_0_implementationClassHash = num.toHex(
  "0x7595b4f7d50010ceb00230d8b5656e3c3dd201b6df35d805d3f2988c69a1432",
);

export const v0_2_0_proxyClassHash = num.toHex(
  "0x071c3c99f5cf76fc19945d4b8b7d34c7c5528f22730d56192b50c6bbfd338a64",
);

export const metaV0ContractAddress =
  "0x03e21ab91c0899efc48b6d6ccd09b61fd37766e9b0c3cc968a7655632fbc253c";

export const newestReadyImplementationClassHash = v0_4_0_implementationClassHash;

export enum OldAccountVersion {
  v0_2_0,
  v0_2_1,
  v0_2_2,
  v0_2_3_0,
  v0_2_3_1,
  v0_3_0,
  v0_3_1,
  v0_4_0,
}

export enum ProxyType {
  OldProxy,
  NewProxy,
  NoProxy,
}

export interface ILogger {
  log(...args: unknown[]): void;
}

export function getAccountVersionLabel(version: OldAccountVersion): string {
  return OldAccountVersion[version];
}

export function getProxyTypeLabel(proxyType: ProxyType): string {
  return ProxyType[proxyType];
}

export async function getAccountVersion(
  logger: ILogger,
  accountAddress: string,
): Promise<[OldAccountVersion, ProxyType, string]> {
  const accountContract = await loadContract(accountAddress);
  const accountClassHash = normalizeHex(await provider.getClassHashAt(accountAddress));

  logger.log("account class hash", accountClassHash);

  let proxyType: ProxyType;
  let implementationClassHash: string;
  if (accountClassHash === v0_2_2_proxyClassHash) {
    implementationClassHash = normalizeHex((await accountContract.get_implementation()).implementation);
    proxyType = ProxyType.NewProxy;
  } else if (accountClassHash === v0_2_0_proxyClassHash) {
    const implementationAddress = normalizeHex((await accountContract.get_implementation()).implementation);
    logger.log("implementationAddress", implementationAddress);
    implementationClassHash = normalizeHex(await provider.getClassHashAt(implementationAddress));
    proxyType = ProxyType.OldProxy;
  } else {
    proxyType = ProxyType.NoProxy;
    implementationClassHash = accountClassHash;
  }

  logger.log("implementationClassHash", implementationClassHash);

  implementationClassHash = normalizeHex(implementationClassHash);

  let version: OldAccountVersion;
  switch (implementationClassHash) {
    case v0_2_0_implementationClassHash:
      version = OldAccountVersion.v0_2_0;
      break;
    case v0_2_1_implementationClassHash:
      version = OldAccountVersion.v0_2_1;
      break;
    case v0_2_2_implementationClassHash:
      version = OldAccountVersion.v0_2_2;
      break;
    case v0_2_3_0_implementationClassHash:
      version = OldAccountVersion.v0_2_3_0;
      break;
    case v0_2_3_1_implementationClassHash:
      version = OldAccountVersion.v0_2_3_1;
      break;
    case v0_3_0_implementationClassHash:
      version = OldAccountVersion.v0_3_0;
      break;
    case v0_3_1_implementationClassHash:
      version = OldAccountVersion.v0_3_1;
      break;
    case v0_4_0_implementationClassHash:
      version = OldAccountVersion.v0_4_0;
      break;
    default:
      throw new Error("Unknown implementation class hash");
  }

  return [version, proxyType, implementationClassHash];
}

export class KeyPair extends Signer {
  constructor(pk?: string | bigint) {
    super(pk ? `${pk}` : ec.starkCurve.utils.randomPrivateKey());
  }

  public get privateKey() {
    const privateKeyHex =
      this.pk instanceof Uint8Array
        ? `0x${Array.from(this.pk)
            .map((value) => value.toString(16).padStart(2, "0"))
            .join("")}`
        : `${this.pk}`;
    return BigInt(normalizeHex(privateKeyHex));
  }

  public get publicKey() {
    return BigInt(ec.starkCurve.getStarkKey(this.pk));
  }
}

export interface OutsideExecution {
  caller: string;
  nonce: BigNumberish;
  execute_after: BigNumberish;
  execute_before: BigNumberish;
  calls: OutsideCall[];
}

export interface OutsideCall {
  to: string;
  selector: BigNumberish;
  calldata: RawArgs;
}

export async function loadContract(contractAddress: string): Promise<Contract> {
  const { abi } = await provider.getClassAt(contractAddress);
  if (!abi) {
    throw new Error("Error while getting ABI");
  }
  return new Contract(abi, contractAddress, provider);
}

export function getOutsideCall(call: Call): OutsideCall {
  return {
    to: call.contractAddress,
    selector: hash.getSelectorFromName(call.entrypoint),
    calldata: call.calldata ?? [],
  };
}

function getDomain(chainId: string) {
  return {
    name: "Account.execute_from_outside",
    version: "1",
    chainId,
  };
}

function getTypedData(outsideExecution: OutsideExecution, chainId: string) {
  return {
    types: {
      StarkNetDomain: [
        { name: "name", type: "felt" },
        { name: "version", type: "felt" },
        { name: "chainId", type: "felt" },
      ],
      OutsideExecution: [
        { name: "caller", type: "felt" },
        { name: "nonce", type: "felt" },
        { name: "execute_after", type: "felt" },
        { name: "execute_before", type: "felt" },
        { name: "calls_len", type: "felt" },
        { name: "calls", type: "OutsideCall*" },
      ],
      OutsideCall: [
        { name: "to", type: "felt" },
        { name: "selector", type: "felt" },
        { name: "calldata_len", type: "felt" },
        { name: "calldata", type: "felt*" },
      ],
    },
    primaryType: "OutsideExecution",
    domain: getDomain(chainId),
    message: {
      ...outsideExecution,
      calls_len: outsideExecution.calls.length,
      calls: outsideExecution.calls.map((call) => ({
        ...call,
        calldata_len: call.calldata.length,
        calldata: call.calldata,
      })),
  },
  };
}

export async function getOutsideExecutionCall(
  outsideExecution: OutsideExecution,
  accountAddress: string,
  privateKey: string,
  chainId: string,
): Promise<Call> {
  const currentTypedData = getTypedData(outsideExecution, chainId);
  const messageHash = typedData.getMessageHash(currentTypedData, accountAddress);
  const { r, s } = ec.starkCurve.sign(messageHash, privateKey);
  const signature = [r.toString(), s.toString()];

  return {
    contractAddress: accountAddress,
    entrypoint: "execute_from_outside",
    calldata: CallData.compile({ ...outsideExecution, signature }),
  };
}

export async function verifyAccountOwnerAndGuardian(
  logger: ILogger,
  accountAddress: string,
  privateKey: string,
  accountVersion: OldAccountVersion,
  implementationClassHash: string,
) {
  const keyPair = new KeyPair(privateKey);
  const { abi } = await provider.getClassByHash(implementationClassHash);
  const accountContract = new Contract(abi, accountAddress, provider);

  logger.log("keyPair.pubKey", keyPair.publicKey);

  let currentSigner: string;
  let currentGuardian: string;

  switch (accountVersion) {
    case OldAccountVersion.v0_2_0:
    case OldAccountVersion.v0_2_1:
    case OldAccountVersion.v0_2_2:
      currentSigner = num.toHexString((await accountContract.get_signer()).signer);
      currentGuardian = num.toHexString((await accountContract.get_guardian()).guardian);
      break;
    case OldAccountVersion.v0_2_3_0:
    case OldAccountVersion.v0_2_3_1:
      currentSigner = num.toHexString(await provider.getStorageAt(accountAddress, selector.starknetKeccak("_signer")));
      currentGuardian = num.toHexString(await provider.getStorageAt(accountAddress, selector.starknetKeccak("_guardian")));
      break;
    case OldAccountVersion.v0_3_0:
    case OldAccountVersion.v0_3_1:
      currentSigner = num.toHexString(await accountContract.get_owner());
      currentGuardian = num.toHexString(await accountContract.get_guardian());
      break;
    default:
      throw new Error("Unsupported version for verification of owner and guardian");
  }

  logger.log("currentSigner", num.toBigInt(currentSigner));
  logger.log("currentGuardian", num.toBigInt(currentGuardian));
  if (num.toBigInt(currentSigner) !== keyPair.publicKey) {
    throw new Error("Signer doesn't match private key");
  }
  if (currentGuardian !== "0x0") {
    throw new Error("Account has a guardian, can't upgrade");
  }
}

export async function upgradeOldContract(
  logger: ILogger,
  accountAddress: string,
  privateKey: string,
): Promise<string | Call | null> {
  logger.log("upgrading old account:", accountAddress);

  const [accountVersion, accountProxyType, implementationClassHash] = await getAccountVersion(logger, accountAddress);

  if (accountVersion === OldAccountVersion.v0_4_0) {
    logger.log("Account is already at the latest version");
    return null;
  }

  logger.log("account version", OldAccountVersion[accountVersion]);
  logger.log("proxy type", ProxyType[accountProxyType]);
  await verifyAccountOwnerAndGuardian(logger, accountAddress, privateKey, accountVersion, implementationClassHash);

  switch (accountVersion) {
    case OldAccountVersion.v0_2_0:
    case OldAccountVersion.v0_2_1:
    case OldAccountVersion.v0_2_2:
      return upgradeV0(logger, accountAddress, privateKey, implementationClassHash, accountProxyType, accountVersion);
    case OldAccountVersion.v0_2_3_0:
    case OldAccountVersion.v0_2_3_1:
      return upgradeFrom_0_2_3(logger, accountAddress, privateKey, accountProxyType);
    case OldAccountVersion.v0_3_0:
    case OldAccountVersion.v0_3_1:
      return upgrade_from_0_3_efo(logger, accountAddress, privateKey);
  }
}

export async function upgradeFrom_0_2_3(
  logger: ILogger,
  accountAddress: string,
  privateKey: string,
  proxyType: ProxyType,
  targetImplementationClassHash = v0_4_0_implementationClassHash,
  upgradeCalldata: string[] = ["0"],
): Promise<string> {
  if (proxyType === ProxyType.NoProxy) {
    throw new Error("Old version must have a proxy");
  }

  const accountToUpgrade = new Account(provider, accountAddress, privateKey);

  const nonce = await provider.getNonceForAddress(accountAddress);
  logger.log("nonce", nonce);

  const call = {
    contractAddress: accountAddress,
    entrypoint: "upgrade",
    calldata: CallData.compile({ implementation: targetImplementationClassHash, calldata: upgradeCalldata }),
  };

  try {
    const submitResult = await accountToUpgrade.execute([call]);
    logger.log("upgrade to v0.4.0 transaction hash", submitResult.transaction_hash);
    return submitResult.transaction_hash;
  } catch (err) {
    if (err instanceof Error && err.message.includes("exceed balance")) {
      logger.log("Not enough STRK to pay for the upgrade transaction", err.message);
      throw new Error("Not enough STRK to pay for the upgrade transaction");
    }
    throw err;
  }
}

export async function upgradeV0(
  logger: ILogger,
  accountAddress: string,
  privateKey: string,
  implementationClassHash: string,
  proxyType: ProxyType,
  currentVersion: OldAccountVersion,
  targetImplementationClassHash = v0_2_3_1_implementationClassHash,
  targetImplementationAddress = v0_2_3_1_implementationAddress,
): Promise<Call> {
  if (proxyType === ProxyType.NoProxy) {
    throw new Error("Old version must have a proxy");
  }
  if (proxyType === ProxyType.OldProxy && currentVersion === OldAccountVersion.v0_2_2) {
    throw new Error("v0.2.2 with old proxy is not supported");
  }

  const { abi } = await provider.getClassByHash(implementationClassHash);
  const accountContract = new Contract(abi, accountAddress, provider);

  const nonce = (await accountContract.get_nonce()).nonce;
  logger.log("nonce", nonce);

  const upgradeTargetClassHashOrAddress =
    proxyType === ProxyType.NewProxy ? targetImplementationClassHash : targetImplementationAddress;

  const call = {
    to: accountAddress,
    selector: hash.getSelector("upgrade"),
    calldata: [upgradeTargetClassHashOrAddress],
  };

  const unsignedRequest = {
    type: "INVOKE",
    max_fee: num.toHexString(0),
    version: "0x0",
    contract_address: accountAddress,
    entry_point_selector: hash.getSelector("__execute__"),
    calldata: [
      "0x1",
      call.to,
      call.selector,
      "0x0",
      num.toHex(call.calldata.length),
      num.toHex(call.calldata.length),
      ...call.calldata,
      num.toHex(nonce),
    ],
  };

  const msgHashToSign = await (async () => {
    if (implementationClassHash === v0_2_0_implementationClassHash) {
      const calldataHash = hash.computeHashOnElements(call.calldata);
      const callHash = hash.computeHashOnElements([call.to, call.selector, calldataHash]);
      const callsHash = hash.computeHashOnElements([callHash]);
      return hash.computeHashOnElements([
        shortString.encodeShortString("StarkNet Transaction"),
        accountAddress,
        callsHash,
        nonce,
        0,
        0,
      ]);
    }

    return v2hash.calculateTransactionHashCommon(
      constants.TransactionHashPrefix.INVOKE,
      unsignedRequest.version,
      unsignedRequest.contract_address,
      unsignedRequest.entry_point_selector,
      unsignedRequest.calldata,
      unsignedRequest.max_fee,
      await provider.getChainId(),
    );
  })();

  const signatureObj = ec.starkCurve.sign(msgHashToSign, privateKey) as { r: bigint; s: bigint };
  const signatureArray = [num.toHexString(signatureObj["r"]), num.toHexString(signatureObj["s"])];

  const meta_tx_calldata = CallData.compile({
    target: unsignedRequest.contract_address,
    entry_point_selector: unsignedRequest.entry_point_selector,
    calldata: unsignedRequest.calldata,
    signature: signatureArray,
  });

  const upgrade_0_2_3_1_call: Call = {
    contractAddress: metaV0ContractAddress,
    entrypoint: "execute_meta_tx_v0",
    calldata: meta_tx_calldata,
  };

  logger.log(`1- Go to https://voyager.online/contract/${upgrade_0_2_3_1_call.contractAddress}#writeContract`);
  logger.log(`2- Go to "Write Contract".`);
  logger.log(`3- Connect with another funded account.`);
  logger.log(`4- Expand "${upgrade_0_2_3_1_call.entrypoint}" function.`);
  logger.log(`5- Enable "Format Calldata`);
  logger.log(`6- Paste the following calldata:`);
    const calldata = Array.isArray(upgrade_0_2_3_1_call.calldata)
      ? (upgrade_0_2_3_1_call.calldata as string[])
      : [];
    logger.log(calldata.join(", "));
  logger.log(`7- Click "Transact" and confirm on your wallet`);
  logger.log(`8- Restart upgrade after the transaction is confirmed.`);

  return upgrade_0_2_3_1_call;
}

export async function upgrade_from_0_3_efo(
  logger: ILogger,
  accountAddress: string,
  privateKey: string,
): Promise<Call> {
  const outsideExec = {
    caller: shortString.encodeShortString("ANY_CALLER"),
    nonce: stark.randomAddress(),
    execute_after: 0,
    execute_before: Math.floor(Date.now() / 1000 + 86400 * 7),
    calls: [
      getOutsideCall({
        contractAddress: accountAddress,
        entrypoint: "upgrade",
        calldata: CallData.compile({ newClassHash: v0_4_0_implementationClassHash, calldata: [] }),
      }),
    ],
  };
  const upgrade_0_4_call = await getOutsideExecutionCall(
    outsideExec,
    accountAddress,
    privateKey,
    await provider.getChainId(),
  );

  const calldata = Array.isArray(upgrade_0_4_call.calldata)
    ? (upgrade_0_4_call.calldata as string[])
    : [];
  logger.log(`1- Go to https://voyager.online/contract/${upgrade_0_4_call.contractAddress}#writeContract`);
  logger.log(`2- Go to "Write Contract".`);
  logger.log(`3- Connect with another funded account.`);
  logger.log(`4- Expand "${upgrade_0_4_call.entrypoint}" function.`);
  logger.log(`5- Enable "Format Calldata`);
  logger.log(`6- Paste the following calldata:`);
  logger.log(calldata.join(", "));
  logger.log(`7- Click "Transact" and confirm on your wallet`);
  logger.log(`8- Restart upgrade after the transaction is confirmed.`);

  return upgrade_0_4_call;
}

export async function isAccountAddressCompatible(address: string): Promise<boolean> {
  try {
    await provider.getClassHashAt(address);
    return true;
  } catch {
    return false;
  }
}

export function getDefaultDerivationPaths() {
  return {
    newPath: "m/44'/9004'/0'/0",
    oldPath: "m/2645'/1195502025'/1148870696'/0'/0'",
  };
}
