import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CORS, json } from '../_shared/http.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { deviceId } = await req.json()
  if (!deviceId) return json({ status: 'error', message: 'deviceId required' }, 400)

  const ip  = req.headers.get('cf-connecting-ip') ??
              req.headers.get('x-real-ip') ??
              req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ??
              'unknown'
  const now = Date.now()

  // 先查该设备最近一条试用记录：已有记录则直接返回，无需限流检查
  const { data: trial } = await supabase
    .from('trials')
    .select('expires_at')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (trial) {
    const expiresAt = new Date(trial.expires_at).getTime()
    if (now < expiresAt) {
      return json({ status: 'trial', remainingSecs: Math.floor((expiresAt - now) / 1000) })
    }
    return json({ status: 'expired' })
  }

  // 首次访问：先做 IP 限流（防止恶意批量创建试用记录）
  const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('trials')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', tenMinAgo)
  if ((count ?? 0) >= 3) return json({ status: 'error', message: 'rate limited' }, 429)

  // 插入试用记录
  const expiresAt = new Date(now + 5 * 60 * 1000).toISOString()
  await supabase.from('trials').insert({ device_id: deviceId, ip, expires_at: expiresAt })
  return json({ status: 'trial', remainingSecs: 300 })
})
