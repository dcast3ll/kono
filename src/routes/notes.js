import { Router } from "express"
import { randomUUID } from "node:crypto"
import { supabaseAsUser } from "../lib/supabase.js"
import { requireAuth } from "../middleware/auth.js"
import { isUnlocked } from "../middleware/unlock.js"
import { HttpError } from "../lib/http.js"
import {
  notePayloadSchema,
  dateQuerySchema,
  searchQuerySchema,
  timesheetQuerySchema,
  itemPatchSchema,
} from "../schemas/notes.js"

const router = Router()
router.use(requireAuth)

const clientFor = (req) => supabaseAsUser(req.accessToken)

function normalizeContent(payload) {
  if (payload.type !== "CHECKLIST") return payload.content
  return payload.content.map((item) => ({
    id: item.id ?? randomUUID(),
    text: item.text,
    done: item.done ?? false,
  }))
}

router.get("/search", async (req, res) => {
  const params = searchQuerySchema.parse(req.query)
  const all = params.all === "true"

  if (!all && !params.date) {
    throw new HttpError(400, "date_required", "date is required when all=false")
  }

  let query = clientFor(req)
    .from("notes")
    .select("*", { count: "exact" })
    .textSearch("search_vector", params.q, { type: "websearch", config: "simple" })

  if (!all) query = query.eq("note_date", params.date)
  if (params.type) query = query.eq("type", params.type)
  if (!isUnlocked(req)) query = query.neq("type", "PRIVATE")

  query = query
    .order("note_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(params.offset, params.offset + params.limit - 1)

  const { data, error, count } = await query
  if (error) throw new HttpError(400, "search_failed", error.message)

  res.json({ notes: data, total: count, limit: params.limit, offset: params.offset })
})

router.get("/timesheet", async (req, res) => {
  const { from, to } = timesheetQuerySchema.parse(req.query)

  const { data, error } = await clientFor(req)
    .from("notes")
    .select("note_date, duration_mins")
    .eq("type", "WORK")
    .gte("note_date", from)
    .lte("note_date", to)

  if (error) throw new HttpError(500, "timesheet_failed", error.message)

  const byDate = new Map()
  let total = 0
  for (const row of data) {
    const minutes = row.duration_mins ?? 0
    total += minutes
    byDate.set(row.note_date, (byDate.get(row.note_date) ?? 0) + minutes)
  }

  res.json({
    from,
    to,
    total_mins: total,
    total_hours: Number((total / 60).toFixed(2)),
    days: [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, minutes]) => ({
        date,
        total_mins: minutes,
        total_hours: Number((minutes / 60).toFixed(2)),
      })),
  })
})

router.get("/", async (req, res) => {
  const { date } = dateQuerySchema.parse(req.query)

  const { data, error } = await clientFor(req)
    .from("notes")
    .select("*")
    .eq("note_date", date)
    .order("created_at", { ascending: true })

  if (error) throw new HttpError(500, "notes_unavailable", error.message)

  const notes = isUnlocked(req)
    ? data
    : data.map((note) =>
        note.type === "PRIVATE"
          ? {
              id: note.id,
              note_date: note.note_date,
              type: note.type,
              created_at: note.created_at,
              locked: true,
            }
          : note,
      )

  res.json({ notes })
})

router.post("/", async (req, res) => {
  const payload = notePayloadSchema.parse(req.body)

  const row = {
    user_id: req.user.id,
    note_date: payload.note_date,
    type: payload.type,
    title: payload.title ?? null,
    content: normalizeContent(payload),
    is_private: payload.type === "PRIVATE",
  }

  const { data, error } = await clientFor(req).from("notes").insert(row).select().single()
  if (error) throw new HttpError(400, "note_create_failed", error.message)

  res.status(201).json({ note: data })
})

router.put("/:id", async (req, res) => {
  const payload = notePayloadSchema.parse(req.body)

  const update = {
    note_date: payload.note_date,
    type: payload.type,
    title: payload.title ?? null,
    content: normalizeContent(payload),
    is_private: payload.type === "PRIVATE",
  }

  const { data, error } = await clientFor(req)
    .from("notes")
    .update(update)
    .eq("id", req.params.id)
    .select()
    .maybeSingle()

  if (error) throw new HttpError(400, "note_update_failed", error.message)
  if (!data) throw new HttpError(404, "note_not_found", "Note not found")

  res.json({ note: data })
})

router.delete("/:id", async (req, res) => {
  const { data, error } = await clientFor(req)
    .from("notes")
    .delete()
    .eq("id", req.params.id)
    .select("id")
    .maybeSingle()

  if (error) throw new HttpError(400, "note_delete_failed", error.message)
  if (!data) throw new HttpError(404, "note_not_found", "Note not found")

  res.json({ status: "deleted", id: data.id })
})

router.patch("/:id/items/:itemId", async (req, res) => {
  const { done } = itemPatchSchema.parse(req.body)
  const client = clientFor(req)

  const { data: note, error } = await client
    .from("notes")
    .select("id, type, content")
    .eq("id", req.params.id)
    .maybeSingle()

  if (error) throw new HttpError(500, "note_unavailable", error.message)
  if (!note) throw new HttpError(404, "note_not_found", "Note not found")
  if (note.type !== "CHECKLIST" || !Array.isArray(note.content)) {
    throw new HttpError(409, "not_a_checklist", "Note is not a checklist")
  }

  const items = note.content.map((item) =>
    item.id === req.params.itemId ? { ...item, done } : item,
  )
  if (!items.some((item) => item.id === req.params.itemId)) {
    throw new HttpError(404, "item_not_found", "Checklist item not found")
  }

  const { data: updated, error: updateError } = await client
    .from("notes")
    .update({ content: items })
    .eq("id", note.id)
    .select()
    .single()

  if (updateError) throw new HttpError(400, "item_update_failed", updateError.message)

  res.json({ note: updated })
})

export default router
