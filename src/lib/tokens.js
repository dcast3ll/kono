import { createHash, randomBytes } from "node:crypto"

const AGENT_TOKEN_PREFIX = "kono_agent_"

export function generateAgentToken() {
  return `${AGENT_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`
}

export function isAgentToken(value) {
  return typeof value === "string" && value.startsWith(AGENT_TOKEN_PREFIX)
}

export function hashAgentToken(token) {
  return createHash("sha256").update(token).digest("hex")
}
