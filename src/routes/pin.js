import { Router } from "express"
import { supabaseAsUser } from "../lib/supabase.js"
import { requireAuth } from "../middleware/auth.js"
import { hashPin, verifyPin, signUnlockToken } from "../lib/crypto.js"
import { env } from "../config/env.js"
import { HttpError } from "../lib/http.js"
import { pinSetupSchema, pinChangeSchema, pinVerifySchema } from "../schemas/auth.js"

const router = Router()
router.use(requireAuth)

const UNLOCK_TTL_SECONDS = 30 * 60

function lockoutMs(attempts) {
  if (attempts >= 15) return 60 * 60 * 1000
  if (attempts >= 10) return 15 * 60 * 1000
  if (attempts >= 5) return 60 * 1000
  return 0
}

async function loadProfile(req) {
  const client = supabaseAsUser(req.accessToken)
  const { data, error } = await client
    .from("profiles")
    .select("id, global_pin_hash, pin_failed_attempts, pin_locked_until")
    .eq("id", req.user.id)
    .single()

  if (error) throw new HttpError(500, "profile_unavailable", "Could not load profile")
  return { client, profile: data }
}

router.post("/setup", async (req, res) => {
  const { pin } = pinSetupSchema.parse(req.body)
  const { client, profile } = await loadProfile(req)

  if (profile.global_pin_hash) {
    throw new HttpError(409, "pin_already_set", "PIN already configured; use PUT /api/pin to change it")
  }

  const hash = await hashPin(pin)
  const { error } = await client.from("profiles").update({ global_pin_hash: hash }).eq("id", req.user.id)
  if (error) throw new HttpError(500, "pin_setup_failed", "Could not save PIN")

  res.status(201).json({ status: "pin_set" })
})

router.put("/", async (req, res) => {
  const { currentPin, newPin } = pinChangeSchema.parse(req.body)
  const { client, profile } = await loadProfile(req)

  if (!profile.global_pin_hash) throw new HttpError(409, "pin_not_set", "No PIN configured")

  const valid = await verifyPin(currentPin, profile.global_pin_hash)
  if (!valid) throw new HttpError(401, "invalid_pin", "Invalid PIN")

  const hash = await hashPin(newPin)
  const { error } = await client
    .from("profiles")
    .update({ global_pin_hash: hash, pin_failed_attempts: 0, pin_locked_until: null })
    .eq("id", req.user.id)

  if (error) throw new HttpError(500, "pin_change_failed", "Could not update PIN")
  res.json({ status: "pin_changed" })
})

router.post("/verify", async (req, res) => {
  const { pin } = pinVerifySchema.parse(req.body)
  const { client, profile } = await loadProfile(req)

  if (!profile.global_pin_hash) throw new HttpError(409, "pin_not_set", "No PIN configured")

  const now = Date.now()
  const lockedUntil = profile.pin_locked_until ? new Date(profile.pin_locked_until).getTime() : 0
  if (lockedUntil > now) {
    const retryAfter = Math.ceil((lockedUntil - now) / 1000)
    res.set("Retry-After", String(retryAfter))
    throw new HttpError(429, "pin_locked", `PIN locked. Retry in ${retryAfter}s`)
  }

  const valid = await verifyPin(pin, profile.global_pin_hash)
  if (!valid) {
    const attempts = (profile.pin_failed_attempts ?? 0) + 1
    const lock = lockoutMs(attempts)
    const nextLockedUntil = lock > 0 ? new Date(now + lock).toISOString() : null

    await client
      .from("profiles")
      .update({ pin_failed_attempts: attempts, pin_locked_until: nextLockedUntil })
      .eq("id", req.user.id)

    throw new HttpError(401, "invalid_pin", "Invalid PIN")
  }

  await client
    .from("profiles")
    .update({ pin_failed_attempts: 0, pin_locked_until: null })
    .eq("id", req.user.id)

  const unlockToken = signUnlockToken({
    userId: req.user.id,
    secret: env.unlockTokenSecret,
    ttlSeconds: UNLOCK_TTL_SECONDS,
  })

  res.json({ unlockToken, expiresIn: UNLOCK_TTL_SECONDS })
})

router.delete("/", async (req, res) => {
  const { client } = await loadProfile(req)
  await client
    .from("profiles")
    .update({ global_pin_hash: null, pin_failed_attempts: 0, pin_locked_until: null })
    .eq("id", req.user.id)

  res.json({ status: "pin_removed" })
})

export default router
