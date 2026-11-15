import { Router } from "express"
import { supabase, supabaseAsUser } from "../lib/supabase.js"
import { setSessionCookies, clearSessionCookies } from "../lib/cookies.js"
import { requireAuth } from "../middleware/auth.js"
import { HttpError } from "../lib/http.js"
import { registerSchema, loginSchema } from "../schemas/auth.js"

const router = Router()

const normalizeEmail = (value) => value.trim().toLowerCase()

router.post("/register", async (req, res) => {
  const { email, password } = registerSchema.parse(req.body)

  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
  })

  if (error) throw new HttpError(400, "signup_failed", error.message)

  if (data.session) {
    setSessionCookies(res, data.session)
    return res.status(201).json({
      status: "authenticated",
      user: { id: data.user.id, email: data.user.email },
    })
  }

  res.status(201).json({ status: "confirmation_required" })
})

router.post("/login", async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  })

  if (error) throw new HttpError(401, "invalid_credentials", "Invalid email or password")

  setSessionCookies(res, data.session)
  res.json({ user: { id: data.user.id, email: data.user.email } })
})

router.post("/logout", (req, res) => {
  clearSessionCookies(res)
  res.json({ status: "logged_out" })
})

router.get("/me", requireAuth, async (req, res) => {
  const client = supabaseAsUser(req.accessToken)
  const { data: profile, error } = await client
    .from("profiles")
    .select("id, timezone, global_pin_hash, created_at")
    .eq("id", req.user.id)
    .single()

  if (error) throw new HttpError(500, "profile_unavailable", "Could not load profile")

  res.json({
    user: { id: req.user.id, email: req.user.email },
    profile: {
      id: profile.id,
      timezone: profile.timezone,
      pinConfigured: Boolean(profile.global_pin_hash),
      createdAt: profile.created_at,
    },
  })
})

export default router
