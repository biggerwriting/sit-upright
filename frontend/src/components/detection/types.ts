// frontend/src/components/detection/types.ts
import type { Segment } from '@/types'

export type PostureDonutProps = {
  goodSeconds: number
  badSeconds:  number
}

export type PostureTimelineProps = {
  segments: Segment[]
}

export type AlertBannerProps = {
  show: boolean
}

export type QuotaBannerProps = {
  remainingSeconds: number
}

export type SessionControlsProps = {
  status: 'idle' | 'loading' | 'running'
  onStart: () => void
  onStop:  () => void
}
