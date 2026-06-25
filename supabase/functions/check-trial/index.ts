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

  const { deviceId } = await req.json()
  if (!deviceId) return json({ status: 'error', message: 'deviceId required' }, 400)

  // IP 限流：10 分钟内同一 IP 最多创建 3 条试用记录
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('trials')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', tenMinAgo)
  if ((count ?? 0) >= 3) return json({ status: 'error', message: 'rate limited' }, 429)

  // 查该设备最近一条试用记录
  const { data: trial } = await supabase
    .from('trials')
    .select('expires_at')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const now = Date.now()

  if (!trial) {
    // 首次访问：插入试用记录
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString()
    await supabase.from('trials').insert({ device_id: deviceId, ip, expires_at: expiresAt })
    return json({ status: 'trial', remainingSecs: 300 })
  }

  const expiresAt = new Date(trial.expires_at).getTime()
  if (now < expiresAt) {
    return json({ status: 'trial', remainingSecs: Math.floor((expiresAt - now) / 1000) })
  }

  return json({ status: 'expired' })
})
