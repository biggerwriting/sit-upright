// frontend/src/hooks/useSessionTracker.ts
import { useState, useCallback, useRef } from 'react'
import type { Segment, SessionStats } from '@/types'

const EMPTY_STATS: SessionStats = {
  totalSeconds: 0,
  goodSeconds: 0,
  badSeconds: 0,
  segments: [],
}

export function useSessionTracker() {
  const [stats, setStats] = useState<SessionStats>(EMPTY_STATS)
  // Use refs to avoid stale closure issues in useCallback
  const currentSegTypeRef = useRef<'good' | 'bad' | null>(null)
  const currentSegDurationRef = useRef<number>(0)

  const tick = useCallback((isHunching: boolean) => {
    const type: 'good' | 'bad' = isHunching ? 'bad' : 'good'

    setStats(prev => {
      const newTotal = prev.totalSeconds + 1
      const newGood  = prev.goodSeconds + (isHunching ? 0 : 1)
      const newBad   = prev.badSeconds  + (isHunching ? 1 : 0)

      if (type === currentSegTypeRef.current) {
        // Same posture type: extend current segment
        currentSegDurationRef.current += 1
        const dur = currentSegDurationRef.current
        const updatedSegs = [...prev.segments]
        updatedSegs[updatedSegs.length - 1] = { type, durationSeconds: dur }
        return { totalSeconds: newTotal, goodSeconds: newGood, badSeconds: newBad, segments: updatedSegs }
      }

      // Posture type changed: append new segment
      currentSegTypeRef.current = type
      currentSegDurationRef.current = 1
      return {
        totalSeconds: newTotal,
        goodSeconds: newGood,
        badSeconds: newBad,
        segments: [...prev.segments, { type, durationSeconds: 1 }],
      }
    })
  }, [])

  const reset = useCallback(() => {
    currentSegTypeRef.current = null
    currentSegDurationRef.current = 0
    setStats(EMPTY_STATS)
  }, [])

  return { stats, tick, reset }
}
