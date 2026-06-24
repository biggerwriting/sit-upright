'use client'
import { useState, useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import type { PostureResult } from '@/types'
import { analyzePosture } from './usePostureAnalyzer'

// MediaPipe 骨架连接线（与 check_posture.py 一致）
const CONNECTIONS: [number, number][] = [
  [0, 11], [0, 12], [11, 12],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [24, 26], [25, 27], [26, 28],
]
const KEY_IDXS = [0, 11, 12, 23, 24, 25, 26, 27, 28]

export type MediaPipeStatus = 'idle' | 'loading' | 'ready' | 'error'

export function useMediaPipe(
  videoRef: RefObject<HTMLVideoElement>,
  canvasRef: RefObject<HTMLCanvasElement>,
  onPostureResult: (result: PostureResult) => void
) {
  const [status, setStatus] = useState<MediaPipeStatus>('idle')
  const rafRef      = useRef<number | null>(null)
  const landmarkerRef = useRef<PoseLandmarker | null>(null)
  const startTimeRef  = useRef<number>(0)

  const initialize = useCallback(async () => {
    setStatus('loading')
    try {
      const { PoseLandmarker, FilesetResolver } =
        await import('@mediapipe/tasks-vision')

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      )
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
      })
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  const startDetection = useCallback(async () => {
    if (status !== 'ready') return

    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !landmarkerRef.current) return

    // 请求摄像头（优先前置）
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      })
    } catch {
      setStatus('error')
      return
    }
    video.srcObject = stream
    await video.play()

    startTimeRef.current = performance.now()
    const ctx = canvas.getContext('2d')!

    const loop = () => {
      if (!landmarkerRef.current) return
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      const tsMs = performance.now() - startTimeRef.current

      const result = landmarkerRef.current.detectForVideo(video, tsMs)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (result.landmarks.length > 0) {
        const lms = result.landmarks[0]
        const w = canvas.width, h = canvas.height

        // 画连接线
        ctx.strokeStyle = 'rgba(100,200,100,0.9)'
        ctx.lineWidth   = 2
        for (const [i, j] of CONNECTIONS) {
          ctx.beginPath()
          ctx.moveTo(lms[i].x * w, lms[i].y * h)
          ctx.lineTo(lms[j].x * w, lms[j].y * h)
          ctx.stroke()
        }
        // 画关键点
        ctx.fillStyle = 'rgb(50,150,255)'
        for (const idx of KEY_IDXS) {
          ctx.beginPath()
          ctx.arc(lms[idx].x * w, lms[idx].y * h, 5, 0, Math.PI * 2)
          ctx.fill()
        }

        onPostureResult(analyzePosture(lms))
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [status, videoRef, canvasRef, onPostureResult])

  const stopDetection = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const video = videoRef.current
    if (video?.srcObject) {
      ;(video.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      video.srcObject = null
    }
  }, [videoRef])

  return { status, initialize, startDetection, stopDetection }
}
