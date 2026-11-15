import { supabase } from "../lib/supabase.js"
import { ACCESS_COOKIE, REFRESH_COOKIE, setSessionCookies } from "../lib/cookies.js"
import { HttpError } from "../lib/http.js"

function extractToken(req) {
  const header = req.get("authorization")
  if (header?.startsWith("Bearer ")) return header.slice(7)
  return req.cookies?.[ACCESS_COOKIE] ?? null
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req)
    if (!token) throw new HttpError(401, "unauthorized", "Authentication required")

    const { data, error } = await supabase.auth.getUser(token)
    if (!error && data?.user) {
      req.user = data.user
      req.accessToken = token
      return next()
    }

    const refreshToken = req.cookies?.[REFRESH_COOKIE]
    if (!refreshToken) throw new HttpError(401, "unauthorized", "Invalid or expired session")

    const refreshed = await supabase.auth.refreshSession({ refresh_token: refreshToken })
    if (refreshed.error || !refreshed.data?.session) {
      throw new HttpError(401, "unauthorized", "Invalid or expired session")
    }

    setSessionCookies(res, refreshed.data.session)
    req.accessToken = refreshed.data.session.access_token
    req.user = refreshed.data.user ?? (await supabase.auth.getUser(req.accessToken)).data.user

    if (!req.user) throw new HttpError(401, "unauthorized", "Invalid or expired session")
    next()
  } catch (error) {
    next(error)
  }
}
