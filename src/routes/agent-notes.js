import { Router } from "express"
import { requireAgentToken, requireScope } from "../middleware/agent.js"
import { withUserContext } from "../lib/agent-db.js"
import { agentNoteIngestSchema, agentNotesQuerySchema } from "../schemas/agent.js"

const router = Router()
router.use(requireAgentToken)

router.get("/", requireScope("notes:read"), async (req, res) => {
  const params = agentNotesQuerySchema.parse(req.query)
  const { userId } = req.agent

  const rows = await withUserContext(userId, async (client) => {
    const conditions = ["type <> 'PRIVATE'"]
    const values = []
    let index = 1

    if (params.from) {
      conditions.push(`note_date >= $${index++}`)
      values.push(params.from)
    }
    if (params.to) {
      conditions.push(`note_date <= $${index++}`)
      values.push(params.to)
    }
    if (params.type) {
      conditions.push(`type = $${index++}`)
      values.push(params.type)
    }
    if (params.q) {
      conditions.push(`search_vector @@ websearch_to_tsquery('simple', $${index++})`)
      values.push(params.q)
    }

    const limitIndex = index++
    const offsetIndex = index++
    values.push(params.limit, params.offset)

    const { rows: result } = await client.query(
      `select id, note_date::text as note_date, type, title, content, is_private, created_at, updated_at,
              count(*) over() as total
       from public.notes
       where ${conditions.join(" and ")}
       order by note_date desc, created_at desc
       limit $${limitIndex} offset $${offsetIndex}`,
      values,
    )

    return result
  })

  const total = rows[0]?.total ? Number(rows[0].total) : 0
  const notes = rows.map(({ total: _total, ...note }) => note)

  res.json({ notes, total, limit: params.limit, offset: params.offset })
})

router.post("/", requireScope("agent:write"), async (req, res) => {
  const payload = agentNoteIngestSchema.parse(req.body)
  const { userId } = req.agent

  const note = await withUserContext(userId, async (client) => {
    let noteDate = payload.date

    if (!noteDate) {
      const { rows } = await client.query(
        "select timezone from public.profiles where id = $1",
        [userId],
      )
      const timezone = rows[0]?.timezone ?? "America/Caracas"
      noteDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date())
    }

    const content = { text: payload.text }
    if (payload.agent) content.agent = payload.agent
    if (payload.model) content.model = payload.model

    const { rows } = await client.query(
      `insert into public.notes (user_id, note_date, type, title, content, is_private)
       values ($1, $2, 'AGENT', $3, $4, false)
       returning id, note_date::text as note_date, type, title, content, is_private, created_at, updated_at`,
      [userId, noteDate, payload.title ?? null, content],
    )

    return rows[0]
  })

  res.status(201).json({ note })
})

export default router
