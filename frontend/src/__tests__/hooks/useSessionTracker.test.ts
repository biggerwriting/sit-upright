// frontend/src/__tests__/hooks/useSessionTracker.test.ts
import { renderHook, act } from '@testing-library/react'
import { useSessionTracker } from '@/hooks/useSessionTracker'

describe('useSessionTracker', () => {
  it('初始状态全为 0', () => {
    const { result } = renderHook(() => useSessionTracker())
    expect(result.current.stats).toEqual({
      totalSeconds: 0,
      goodSeconds: 0,
      badSeconds: 0,
      segments: [],
    })
  })

  it('tick(false) 累加 goodSeconds', () => {
    const { result } = renderHook(() => useSessionTracker())
    act(() => { result.current.tick(false) })
    act(() => { result.current.tick(false) })
    expect(result.current.stats.goodSeconds).toBe(2)
    expect(result.current.stats.totalSeconds).toBe(2)
  })

  it('tick(true) 累加 badSeconds', () => {
    const { result } = renderHook(() => useSessionTracker())
    act(() => { result.current.tick(true) })
    expect(result.current.stats.badSeconds).toBe(1)
    expect(result.current.stats.totalSeconds).toBe(1)
  })

  it('状态切换时追加 segment', () => {
    const { result } = renderHook(() => useSessionTracker())
    act(() => { result.current.tick(false) }) // good 1s
    act(() => { result.current.tick(false) }) // good 2s
    act(() => { result.current.tick(true)  }) // bad 1s → 切换
    const { segments } = result.current.stats
    expect(segments).toHaveLength(2)
    expect(segments[0]).toEqual({ type: 'good', durationSeconds: 2 })
    expect(segments[1]).toEqual({ type: 'bad',  durationSeconds: 1 })
  })

  it('reset 清空所有状态', () => {
    const { result } = renderHook(() => useSessionTracker())
    act(() => { result.current.tick(false) })
    act(() => { result.current.reset() })
    expect(result.current.stats.totalSeconds).toBe(0)
    expect(result.current.stats.segments).toHaveLength(0)
  })
})
