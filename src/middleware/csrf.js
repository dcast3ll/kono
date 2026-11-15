import { HttpError } from "../lib/http.js"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export function requireSameOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next()

  const origin = req.get("origin")
  if (!origin) return next()

  let originHost
  try {
    originHost = new URL(origin).host
  } catch {
    return next(new HttpError(403, "bad_origin", "Invalid origin"))
  }

  if (originHost !== req.get("host")) {
    return next(new HttpError(403, "bad_origin", "Cross-origin request rejected"))
  }

  next()
}
