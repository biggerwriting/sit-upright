#!/usr/bin/env node
// 用法：node generate-token.js <配额秒数> <有效天数> "<备注>"
// 示例：node generate-token.js 7200 30 "张三 ¥29 2026-06-25"

require('dotenv').config({ path: __dirname + '/.env' })
const { createClient } = require('@supabase/supabase-js')
const { randomUUID }   = require('crypto')

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SITE_URL) {
  console.error('❌ 缺少环境变量，请先复制 .env.example 为 .env 并填写')
  process.exit(1)
}

const [,, quotaArg = '3600', daysArg = '30', note = ''] = process.argv
const quotaSecs = parseInt(quotaArg)
const days      = parseInt(daysArg)

if (isNaN(quotaSecs) || isNaN(days)) {
  console.error('❌ 用法：node generate-token.js <配额秒数> <有效天数> "<备注>"')
  process.exit(1)
}

;(async () => {
  const supabase  = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const token     = randomUUID()
  const expiresAt = new Date(Date.now() + days * 86400 * 1000).toISOString()

  const { error } = await supabase.from('tokens').insert({
    token, note, expires_at: expiresAt, quota_secs: quotaSecs,
  })
  if (error) { console.error('❌ 写入失败：', error.message); process.exit(1) }

  const url  = `${SITE_URL}/posture-static-demo.html?token=${token}`
  const line = '─'.repeat(64)
  console.log(`\n✅ Token 生成成功`)
  console.log(line)
  console.log(`配额：${quotaSecs} 秒（${Math.round(quotaSecs / 60)} 分钟）`)
  console.log(`有效期至：${new Date(expiresAt).toLocaleString('zh-CN')}`)
  console.log(`备注：${note || '（无）'}`)
  console.log(line)
  console.log('访问链接（发给用户）：')
  console.log(url)
  console.log(line + '\n')
})()
