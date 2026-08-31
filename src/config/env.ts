// Environment variables (Vite exposes VITE_ prefixed vars to the client)
// Set in .env.local or in your deployment platform (Vercel, etc.)

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string
export const APP_VERSION = '3.0.0'
export const ENGINE_VERSION = 'v8.1'
