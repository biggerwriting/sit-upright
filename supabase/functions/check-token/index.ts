import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CORS, json } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { token } = await req.json()
  if (!token) return json({ status: 'invalid' })

  const { data: record } = await supabase
    .from('tokens')
    .select('expires_at, quota_secs, used_secs')
    .eq('token', token)
    .maybeSingle()

  if (!record) return json({ status: 'invalid' })

  if (Date.now() > new Date(record.expires_at).getTime()) {
    return json({ status: 'expired' })
  }

  const remainingSecs = record.quota_secs - record.used_secs
  if (remainingSecs <= 0) return json({ status: 'exhausted' })

  return json({ status: 'valid', remainingSecs, expiresAt: record.expires_at })
})
