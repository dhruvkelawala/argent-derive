import { hexToBytes } from "@noble/hashes/utils";
import { HDKey } from "@scure/bip32";
import { encode, num, ec } from "starknet";
import { HDNodeWallet } from "ethers";

function deriveKeyPair(secret: string, derivationPath: string, index: number) {
  const hex = encode.removeHexPrefix(num.toHex(secret));
  // Bytes must be a multiple of 2 and default is multiple of 8
  // sanitizeHex should not be used because of leading 0x
  const sanitized = encode.sanitizeBytes(hex, 2);
  const masterNode = HDKey.fromMasterSeed(hexToBytes(sanitized));

  const derivationPathWithIndex = `${derivationPath}/${index}`;

  const childNode = masterNode.derive(derivationPathWithIndex);

  if (!childNode.privateKey) {
    throw "childNode.privateKey is undefined";
  }

  const groundKey = ec.starkCurve.grindKey(childNode.privateKey);

  return {
    pk: encode.addHexPrefix(groundKey),
    pubKey: encode.sanitizeHex(ec.starkCurve.getStarkKey(groundKey))
  };
}

function deriveKeyPairFromSeedPhrase(
  seedPhrase: string,
  derivationPath: string,
  index = 0 // Account index
) {
  const ethersWallet = HDNodeWallet.fromPhrase(seedPhrase);
  return deriveKeyPair(ethersWallet.privateKey, derivationPath, index);
}

const DERIVATION_PATH = "m/44'/9004'/0'/0";
const OLD_DERIVATION_PATH = "m/2645'/1195502025'/1148870696'/0'/0'";

const SEED_PHRASE = ""; // Replace with your seed phrase

const { pk, pubKey } = deriveKeyPairFromSeedPhrase(
  SEED_PHRASE,
  DERIVATION_PATH
);

const { pk: oldPk, pubKey: oldPubKey } = deriveKeyPairFromSeedPhrase(
  SEED_PHRASE,
  OLD_DERIVATION_PATH
);

console.log("\nKeys using new derivation path:");
console.log("Private key:", pk);
console.log("Public key:", pubKey);

console.log("\nKeys using old derivation path:");
console.log("Private key:", oldPk);
console.log("Public key:", oldPubKey);
