import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCallback)

export async function hashPin(pin) {
  const salt = randomBytes(16)
  const derived = await scrypt(pin, salt, 64)
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`
}

export async function verifyPin(pin, stored) {
  if (typeof stored !== "string") return false
  const [scheme, saltHex, hashHex] = stored.split("$")
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false

  const salt = Buffer.from(saltHex, "hex")
  const expected = Buffer.from(hashHex, "hex")
  const derived = await scrypt(pin, salt, expected.length)
  if (expected.length !== derived.length) return false
  return timingSafeEqual(expected, derived)
}

export function signUnlockToken({ userId, secret, ttlSeconds = 30 * 60 }) {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString("base64url")
  const signature = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function verifyUnlockToken(token, secret) {
  if (typeof token !== "string") return null
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return null

  const expected = createHmac("sha256", secret).update(payload).digest()
  const provided = Buffer.from(signature, "base64url")
  if (provided.length !== expected.length) return null
  if (!timingSafeEqual(provided, expected)) return null

  let data
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return null
  }

  if (!data || typeof data.sub !== "string" || typeof data.exp !== "number") return null
  if (data.exp * 1000 < Date.now()) return null
  return data
}
