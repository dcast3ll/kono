import "dotenv/config"

const required = (name) => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  appTimezone: process.env.APP_TIMEZONE ?? "America/Bogota",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  unlockTokenSecret: required("UNLOCK_TOKEN_SECRET"),
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
})
