import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const MAX_MEMORY = 32 * 1024 * 1024;
const HASH_VERSION = "scrypt-v1";

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEMORY },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derivedKey = await deriveKey(password, salt);
  return `${HASH_VERSION}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [version, saltEncoded, hashEncoded, ...extra] = storedHash.split("$");
  if (version !== HASH_VERSION || !saltEncoded || !hashEncoded || extra.length > 0) {
    return false;
  }

  try {
    const salt = Buffer.from(saltEncoded, "base64url");
    const expected = Buffer.from(hashEncoded, "base64url");
    if (salt.length !== SALT_BYTES || expected.length !== KEY_LENGTH) {
      return false;
    }

    const actual = await deriveKey(password, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
