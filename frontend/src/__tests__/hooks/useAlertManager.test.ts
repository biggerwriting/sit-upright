// frontend/src/__tests__/hooks/useAlertManager.test.ts
import { renderHook, act } from '@testing-library/react'
import { useAlertManager } from '@/hooks/useAlertManager'

// 静音 audio.play（jsdom 不支持音频）
beforeEach(() => {
  window.HTMLMediaElement.prototype.play  = jest.fn().mockResolvedValue(undefined)
  window.HTMLMediaElement.prototype.pause = jest.fn()
  window.HTMLMediaElement.prototype.load  = jest.fn()
})

describe('useAlertManager', () => {
  it('初始状态不显示文字警告', () => {
    const { result } = renderHook(() => useAlertManager())
    expect(result.current.showTextAlert).toBe(false)
  })

  it('弓腰不足 3 秒时不显示文字警告', () => {
    const { result } = renderHook(() => useAlertManager())
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    expect(result.current.showTextAlert).toBe(false)
  })

  it('连续弓腰 3 秒后显示文字警告', () => {
    const { result } = renderHook(() => useAlertManager())
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    expect(result.current.showTextAlert).toBe(true)
  })

  it('坐正后隐藏文字警告并重置计时', () => {
    const { result } = renderHook(() => useAlertManager())
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    expect(result.current.showTextAlert).toBe(true)
    act(() => { result.current.update(false) })
    expect(result.current.showTextAlert).toBe(false)
  })

  it('reset 后隐藏所有警告', () => {
    const { result } = renderHook(() => useAlertManager())
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    act(() => { result.current.update(true) })
    act(() => { result.current.reset() })
    expect(result.current.showTextAlert).toBe(false)
  })
})
