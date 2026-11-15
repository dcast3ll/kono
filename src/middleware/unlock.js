import { env } from "../config/env.js"
import { verifyUnlockToken } from "../lib/crypto.js"
import { HttpError } from "../lib/http.js"

export const UNLOCK_HEADER = "x-unlock-token"

export function isUnlocked(req) {
  const token = req.get(UNLOCK_HEADER)
  const data = verifyUnlockToken(token, env.unlockTokenSecret)
  return Boolean(data && req.user && data.sub === req.user.id)
}

export function requireUnlocked(req, res, next) {
  if (!isUnlocked(req)) {
    return next(new HttpError(403, "pin_required", "PIN unlock required for private notes"))
  }
  next()
}
