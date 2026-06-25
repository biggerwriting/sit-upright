import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CORS, json } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { token, seconds } = await req.json()
  // FIX 6: reject seconds <= 0 (was < 0) to block free validity-oracle calls with seconds=0
  if (!token || typeof seconds !== 'number' || seconds <= 0) {
    return json({ status: 'error', message: 'invalid params' }, 400)
  }

  // FIX 2 & 4: atomic read-modify-write via DB function;
  // WHERE clause filters expired tokens (expires_at > now()), so 0 rows = invalid or expired
  const { data: rows } = await supabase.rpc('increment_token_usage', {
    p_token: token,
    p_seconds: seconds,
  })

  const record = (rows as { quota_secs: number; used_secs: number }[] | null)?.[0]
  if (!record) return json({ status: 'invalid', remainingSecs: 0 })

  const remainingSecs = record.quota_secs - record.used_secs
  return json({ status: remainingSecs > 0 ? 'valid' : 'exhausted', remainingSecs })
})
