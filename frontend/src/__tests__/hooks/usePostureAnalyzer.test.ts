// frontend/src/__tests__/hooks/usePostureAnalyzer.test.ts
import { analyzePosture } from '@/hooks/usePostureAnalyzer'
import type { Landmark } from '@/types'

/** 构造一个最简 Landmark 数组（33 个点，默认 0,0,0） */
function makeLandmarks(overrides: Record<number, Partial<Landmark>> = {}): Landmark[] {
  return Array.from({ length: 33 }, (_, i) => ({
    x: 0, y: 0, z: 0,
    ...overrides[i],
  }))
}

describe('analyzePosture', () => {
  it('头在肩膀上方足够距离时，判定坐姿良好', () => {
    // 鼻子(0) y=0.3，肩膀(11,12) y=0.6 → dist=0.3 > 0.18
    const landmarks = makeLandmarks({
      0:  { y: 0.3 },
      11: { y: 0.6 },
      12: { y: 0.6 },
    })
    const result = analyzePosture(landmarks)
    expect(result.isHunching).toBe(false)
    expect(result.headShoulderDist).toBeCloseTo(0.3)
  })

  it('头肩距离小于阈值时，判定弓腰', () => {
    // 鼻子(0) y=0.5，肩膀(11,12) y=0.6 → dist=0.1 < 0.18
    const landmarks = makeLandmarks({
      0:  { y: 0.5 },
      11: { y: 0.6 },
      12: { y: 0.6 },
    })
    const result = analyzePosture(landmarks)
    expect(result.isHunching).toBe(true)
  })

  it('鼻子低于肩膀时，判定严重趴伏', () => {
    // 鼻子(0) y=0.7，肩膀 y=0.5 → 鼻子低于肩膀
    const landmarks = makeLandmarks({
      0:  { y: 0.7 },
      11: { y: 0.5 },
      12: { y: 0.5 },
    })
    const result = analyzePosture(landmarks)
    expect(result.isHunching).toBe(true)
  })
})
