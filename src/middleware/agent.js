import { env } from "../config/env.js"
import { hashAgentToken, isAgentToken } from "../lib/tokens.js"
import { authenticateAgentToken } from "../lib/agent-db.js"
import { HttpError } from "../lib/http.js"

function extractBearer(req) {
  const header = req.get("authorization")
  if (!header?.startsWith("Bearer ")) return null
  return header.slice(7).trim()
}

export async function requireAgentToken(req, res, next) {
  try {
    if (!env.databaseUrl) {
      throw new HttpError(503, "agent_unavailable", "Agent access is not configured")
    }

    const token = extractBearer(req)
    if (!isAgentToken(token)) {
      throw new HttpError(401, "invalid_agent_token", "Invalid agent token")
    }

    const agent = await authenticateAgentToken(hashAgentToken(token))
    if (!agent) {
      throw new HttpError(401, "invalid_agent_token", "Invalid or revoked agent token")
    }

    req.agent = {
      tokenId: agent.id,
      userId: agent.user_id,
      scopes: Array.isArray(agent.scopes) ? agent.scopes : [],
    }
    next()
  } catch (error) {
    next(error)
  }
}

export function requireScope(scope) {
  return (req, res, next) => {
    if (!req.agent?.scopes?.includes(scope)) {
      return next(new HttpError(403, "insufficient_scope", `Missing scope: ${scope}`))
    }
    next()
  }
}
