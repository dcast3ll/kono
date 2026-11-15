import express from "express"
import cookieParser from "cookie-parser"
import { fileURLToPath } from "node:url"
import healthRouter from "./routes/health.js"
import authRouter from "./routes/auth.js"
import pinRouter from "./routes/pin.js"
import notesRouter from "./routes/notes.js"
import { requireSameOrigin } from "./middleware/csrf.js"
import { HttpError } from "./lib/http.js"

const app = express()

app.disable("x-powered-by")
app.use(express.json({ limit: "1mb" }))
app.use(cookieParser())
app.use(requireSameOrigin)

const publicDir = fileURLToPath(new URL("../public", import.meta.url))
app.use(express.static(publicDir))

app.use("/api/health", healthRouter)
app.use("/api/auth", authRouter)
app.use("/api/pin", pinRouter)
app.use("/api/notes", notesRouter)

app.use((req, res) => {
  res.status(404).json({
    error: { code: "not_found", message: "Route not found" },
  })
})

app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message },
    })
  }

  if (err?.name === "ZodError") {
    return res.status(400).json({
      error: {
        code: "validation_error",
        message: "Invalid payload",
        issues: err.issues,
      },
    })
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: { code: "invalid_json", message: "Invalid JSON body" },
    })
  }

  console.error(err)
  res.status(500).json({
    error: { code: "internal_error", message: "Unexpected error" },
  })
})

export default app
