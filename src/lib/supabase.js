import { createClient } from "@supabase/supabase-js"
import { env } from "../config/env.js"

const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
}

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: authOptions,
})

export function supabaseAsUser(accessToken) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: authOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}
