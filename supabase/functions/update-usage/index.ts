import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { token, seconds } = await req.json()
  if (!token || typeof seconds !== 'number' || seconds < 0) {
    return json({ status: 'error', message: 'invalid params' }, 400)
  }

  const { data: record } = await supabase
    .from('tokens')
    .select('quota_secs, used_secs')
    .eq('token', token)
    .maybeSingle()

  if (!record) return json({ status: 'invalid', remainingSecs: 0 })

  // 上限保护：used_secs 不超过 quota_secs
  const newUsedSecs = Math.min(record.used_secs + seconds, record.quota_secs)
  await supabase.from('tokens').update({ used_secs: newUsedSecs }).eq('token', token)

  const remainingSecs = record.quota_secs - newUsedSecs
  return json({ status: remainingSecs > 0 ? 'valid' : 'exhausted', remainingSecs })
})
