import app from "./src/app.js"
import { env } from "./src/config/env.js"

const server = app.listen(env.port, () => {
  console.log(`Kono Notes listening on http://localhost:${env.port}`)
})

const shutdown = (signal) => {
  console.log(`${signal} received, closing server`)
  server.close(() => process.exit(0))
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))
