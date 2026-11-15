import { Router } from "express"
import { env } from "../config/env.js"

const startedAt = Date.now()

const router = Router()

router.get("/", (req, res) => {
  res.json({
    status: "ok",
    service: "kono-notes",
    env: env.nodeEnv,
    timezone: env.appTimezone,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  })
})

export default router
