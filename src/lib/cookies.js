import { env } from "../config/env.js"

export const ACCESS_COOKIE = "kono_access"
export const REFRESH_COOKIE = "kono_refresh"

const baseOptions = () => ({
  httpOnly: true,
  sameSite: "lax",
  secure: env.isProduction,
  path: "/",
})

export function setSessionCookies(res, session) {
  res.cookie(ACCESS_COOKIE, session.access_token, {
    ...baseOptions(),
    maxAge: (session.expires_in ?? 3600) * 1000,
  })
  res.cookie(REFRESH_COOKIE, session.refresh_token, {
    ...baseOptions(),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })
}

export function clearSessionCookies(res) {
  res.clearCookie(ACCESS_COOKIE, baseOptions())
  res.clearCookie(REFRESH_COOKIE, baseOptions())
}
