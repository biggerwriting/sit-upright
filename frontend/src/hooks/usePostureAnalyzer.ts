// frontend/src/hooks/usePostureAnalyzer.ts
import { HUNCH_THRESHOLD } from '@/lib/constants'
import type { Landmark, PostureResult } from '@/types'

// MediaPipe 33点关键点索引
const IDX_NOSE       = 0
const IDX_L_SHOULDER = 11
const IDX_R_SHOULDER = 12

export function analyzePosture(landmarks: Landmark[]): PostureResult {
  const nose    = landmarks[IDX_NOSE]
  const lSh     = landmarks[IDX_L_SHOULDER]
  const rSh     = landmarks[IDX_R_SHOULDER]
  const shMidY  = (lSh.y + rSh.y) / 2

  // y 轴向下为正；头在肩上方时 dist > 0
  const headShoulderDist = shMidY - nose.y
  const noseBelowShoulder = nose.y > shMidY

  const isHunching = headShoulderDist < HUNCH_THRESHOLD || noseBelowShoulder

  return { isHunching, headShoulderDist }
}
