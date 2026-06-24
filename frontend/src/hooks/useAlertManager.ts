// frontend/src/hooks/useAlertManager.ts
import { useState, useCallback, useRef } from 'react'
import { ALERT_TEXT_SECONDS, ALERT_VOICE_SECONDS, ALERT_REPEAT_SECONDS } from '@/lib/constants'

export function useAlertManager() {
  const [showTextAlert, setShowTextAlert] = useState(false)
  const hunchSecsRef      = useRef(0)
  const lastVoiceAtRef    = useRef<number | null>(null) // 最后一次语音警告时的累计弓腰秒数

  const playAudio = useCallback(() => {
    const audio = new Audio('/audio/posture-alert.mp3')
    audio.play().catch(() => {
      // 浏览器自动播放策略可能拒绝，静默处理
    })
  }, [])

  const update = useCallback((isHunching: boolean) => {
    if (!isHunching) {
      // 坐正 → 全部重置
      hunchSecsRef.current  = 0
      lastVoiceAtRef.current = null
      setShowTextAlert(false)
      return
    }

    hunchSecsRef.current += 1
    const secs = hunchSecsRef.current

    // 文字警告
    if (secs >= ALERT_TEXT_SECONDS) {
      setShowTextAlert(true)
    }

    // 语音警告：首次触发（5s），之后每 30s 重复
    if (secs >= ALERT_VOICE_SECONDS) {
      const lastAt = lastVoiceAtRef.current
      if (lastAt === null || secs - lastAt >= ALERT_REPEAT_SECONDS) {
        playAudio()
        lastVoiceAtRef.current = secs
      }
    }
  }, [playAudio])

  const reset = useCallback(() => {
    hunchSecsRef.current   = 0
    lastVoiceAtRef.current = null
    setShowTextAlert(false)
  }, [])

  return { showTextAlert, update, reset }
}
