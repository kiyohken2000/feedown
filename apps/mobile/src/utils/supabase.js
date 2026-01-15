import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hejdhzpypxlildhldlsx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhlamRoenB5cHhsaWxkaGxkbHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzODU0NTcsImV4cCI6MjA4Mzk2MTQ1N30.aLMC8au60uvddTmZ68l0JIN4bggq5270VZQnQAA-fEI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// API Base URL (Cloudflare Pages Functions)
export const API_BASE_URL = 'https://feedown.pages.dev'
