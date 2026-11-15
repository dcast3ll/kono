import { Router } from "express"
import { requireAuth } from "../middleware/auth.js"
import { supabaseAsUser } from "../lib/supabase.js"
import { generateAgentToken, hashAgentToken } from "../lib/tokens.js"
import { agentTokenCreateSchema } from "../schemas/agent.js"
import { HttpError } from "../lib/http.js"

const router = Router()
router.use(requireAuth)

const DEFAULT_SCOPES = ["notes:read", "agent:write"]
const TOKEN_COLUMNS = "id, label, scopes, created_at, last_used_at, revoked_at"

router.get("/", async (req, res) => {
  const { data, error } = await supabaseAsUser(req.accessToken)
    .from("agent_tokens")
    .select(TOKEN_COLUMNS)
    .order("created_at", { ascending: false })

  if (error) throw new HttpError(500, "tokens_unavailable", error.message)
  res.json({ tokens: data })
})

router.post("/", async (req, res) => {
  const { label } = agentTokenCreateSchema.parse(req.body)
  const token = generateAgentToken()

  const { data, error } = await supabaseAsUser(req.accessToken)
    .from("agent_tokens")
    .insert({
      user_id: req.user.id,
      token_hash: hashAgentToken(token),
      label: label ?? "Agent token",
      scopes: DEFAULT_SCOPES,
    })
    .select(TOKEN_COLUMNS)
    .single()

  if (error) throw new HttpError(400, "token_create_failed", error.message)
  res.status(201).json({ token, record: data })
})

router.delete("/:id", async (req, res) => {
  const { data, error } = await supabaseAsUser(req.accessToken)
    .from("agent_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", req.params.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle()

  if (error) throw new HttpError(400, "token_revoke_failed", error.message)
  if (!data) throw new HttpError(404, "token_not_found", "Agent token not found")

  res.json({ status: "revoked", id: data.id })
})

export default router
