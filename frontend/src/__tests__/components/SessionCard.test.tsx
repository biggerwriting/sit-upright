// frontend/src/__tests__/components/SessionCard.test.tsx
import { render, screen } from '@testing-library/react'
import { SessionCard } from '@/components/history/SessionCard'
import type { SessionListItem } from '@/types'

const session: SessionListItem = {
  id: 'abc',
  startedAt: '2026-06-24T14:32:00Z',
  endedAt: '2026-06-24T14:57:00Z',
  totalSeconds: 1500,
  goodSeconds: 1200,
  badSeconds: 300,
}

describe('SessionCard', () => {
  it('显示日期和时间', () => {
    render(<SessionCard session={session} />)
    // 日期中包含月和日
    expect(screen.getByText(/6月24日/)).toBeInTheDocument()
  })

  it('显示总时长', () => {
    render(<SessionCard session={session} />)
    expect(screen.getByText(/25 分钟/)).toBeInTheDocument()
  })

  it('显示优秀坐姿时长和百分比', () => {
    render(<SessionCard session={session} />)
    expect(screen.getByText(/20 分钟/)).toBeInTheDocument()
    expect(screen.getByText(/80%/)).toBeInTheDocument()
  })

  it('显示不良坐姿时长和百分比', () => {
    render(<SessionCard session={session} />)
    expect(screen.getByText(/5 分钟/)).toBeInTheDocument()
    expect(screen.getByText(/20%/)).toBeInTheDocument()
  })

  it('渲染时间轴色块', () => {
    render(<SessionCard session={session} />)
    const segments = screen.getAllByTestId('timeline-segment')
    expect(segments).toHaveLength(2)
  })
})
