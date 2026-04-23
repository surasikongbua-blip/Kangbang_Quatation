// ============================================================
// supabase.js — Shared Supabase Client
// ใส่ไฟล์นี้ในทุกหน้า: <script src="js/supabase.js"></script>
// ============================================================

// ⚙️ ใส่ค่าจาก Supabase Dashboard > Project Settings > API
const SUPABASE_URL = 'https://jiwpbwfbkblsfymouzsn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imppd3Bid2Zia2Jsc2Z5bW91enNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NjI1MTQsImV4cCI6MjA5MjUzODUxNH0.nWBAQkojHc-ILA71IJJhUtyBcNW7a9bgEZbUiZaHU4A'

const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Guard: ถ้าไม่ได้ Login ให้กลับไปหน้า Login
// เรียกใช้ในทุกหน้าที่ต้อง Login ก่อน
async function requireAuth() {
  const { data } = await sb.auth.getSession()
  if (!data.session) {
    window.location.href = 'index.html'
    return null
  }
  return data.session.user
}

// Logout
async function logout() {
  await sb.auth.signOut()
  window.location.href = 'index.html'
}
