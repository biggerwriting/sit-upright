'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMediaPipe }       from '@/hooks/useMediaPipe'
import { useSessionTracker }  from '@/hooks/useSessionTracker'
import { useAlertManager }    from '@/hooks/useAlertManager'
import { CameraView }         from '@/components/detection/CameraView'
import { PostureDonut }       from '@/components/detection/PostureDonut'
import { PostureTimeline }    from '@/components/detection/PostureTimeline'
import { AlertBanner }        from '@/components/detection/AlertBanner'
import { SessionControls }    from '@/components/detection/SessionControls'
import { SessionReport }      from '@/components/detection/SessionReport'
import { QuotaBanner }        from '@/components/detection/QuotaBanner'
import { api }                from '@/lib/api'
import { REPORT_INTERVAL_SECONDS } from '@/lib/constants'
import type { PostureResult, QuotaInfo } from '@/types'
import type { SessionStats }  from '@/types'
import type { RefObject }     from 'react'

type PageStatus = 'idle' | 'loading' | 'running'

export default function AppPage() {
  const router    = useRouter()
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [pageStatus, setPageStatus]   = useState<PageStatus>('idle')
  const [quota, setQuota]             = useState<QuotaInfo | null>(null)
  const [sessionId, setSessionId]     = useState<string | null>(null)
  const [finalStats, setFinalStats]   = useState<SessionStats | null>(null)
  const tickTimerRef                  = useRef<ReturnType<typeof setInterval> | null>(null)
  const reportTimerRef                = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastResultRef                 = useRef<PostureResult>({ isHunching: false, headShoulderDist: 0 })

  const tracker = useSessionTracker()
  const alerts  = useAlertManager()

  // 每帧推理回调
  const handlePostureResult = useCallback((result: PostureResult) => {
    lastResultRef.current = result
  }, [])

  const mediaPipe = useMediaPipe(
    videoRef as RefObject<HTMLVideoElement>,
    canvasRef as RefObject<HTMLCanvasElement>,
    handlePostureResult,
  )

  // 进入页面：初始化 MediaPipe + 检查配额
  useEffect(() => {
    mediaPipe.initialize()
    api.getQuota().then(q => {
      if (q.remainingSeconds === 0) router.push('/pricing')
      else setQuota(q)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startSession = useCallback(async () => {
    setPageStatus('loading')
    const { sessionId: sid } = await api.createSession()
    setSessionId(sid)
    await mediaPipe.startDetection()
    setPageStatus('running')

    // 每秒 tick
    tickTimerRef.current = setInterval(() => {
      const { isHunching } = lastResultRef.current
      tracker.tick(isHunching)
      alerts.update(isHunching)
    }, 1000)

    // 每 30s 上报
    reportTimerRef.current = setInterval(() => {
      api.updateSession(sid, {
        goodSeconds: tracker.stats.goodSeconds,
        badSeconds:  tracker.stats.badSeconds,
      }).catch((err: Error) => {
        if (err.message.includes('402')) {
          stopSession()
          setFinalStats({
            totalSeconds: tracker.stats.totalSeconds,
            goodSeconds: tracker.stats.goodSeconds,
            badSeconds: tracker.stats.badSeconds,
            segments: tracker.stats.segments,
          })
        }
      })
    }, REPORT_INTERVAL_SECONDS * 1000)
  }, [mediaPipe, tracker, alerts])

  const stopSession = useCallback(async () => {
    clearInterval(tickTimerRef.current!)
    clearInterval(reportTimerRef.current!)
    mediaPipe.stopDetection()
    alerts.reset()

    const stats = await api.endSession(sessionId!)
    setFinalStats(stats)
    setPageStatus('idle')
    tracker.reset()
  }, [mediaPipe, alerts, tracker, sessionId])

  return (
    <div className="min-h-screen flex flex-col">
      {quota !== null && (
        <QuotaBanner
          remainingSeconds={quota.remainingSeconds}
          nearExpiry={quota.nearExpiry}
        />
      )}

      {/* 主内容：桌面左右 / 手机上下 */}
      <main className="flex-1 flex flex-col md:flex-row gap-4 p-4">
        {/* 摄像头 */}
        <div className="md:w-1/2">
          <CameraView
            videoRef={videoRef as RefObject<HTMLVideoElement>}
            canvasRef={canvasRef as RefObject<HTMLCanvasElement>}
          />
        </div>

        {/* 右侧面板 */}
        <div className="md:w-1/2 flex flex-col items-center gap-6 justify-center">
          <PostureDonut
            goodSeconds={tracker.stats.goodSeconds}
            badSeconds={tracker.stats.badSeconds}
          />
          <PostureTimeline segments={tracker.stats.segments} />
        </div>
      </main>

      {/* 控制按钮 */}
      <div className="flex justify-center pb-6">
        <SessionControls
          status={mediaPipe.status !== 'ready' && pageStatus === 'idle' ? 'loading' : pageStatus}
          onStart={startSession}
          onStop={stopSession}
        />
      </div>

      {/* 警告 */}
      <AlertBanner show={alerts.showTextAlert} />

      {/* 报表 */}
      {finalStats && (
        <SessionReport
          stats={finalStats}
          onClose={() => setFinalStats(null)}
        />
      )}
    </div>
  )
}
