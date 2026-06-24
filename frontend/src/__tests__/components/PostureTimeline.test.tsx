import { render, screen } from '@testing-library/react'
import { PostureTimeline } from '@/components/detection/PostureTimeline'
import type { Segment } from '@/types'

describe('PostureTimeline', () => {
  it('空 segments 时显示占位提示', () => {
    render(<PostureTimeline segments={[]} />)
    expect(screen.getByTestId('timeline-empty')).toBeInTheDocument()
  })

  it('渲染正确数量的色块', () => {
    const segs: Segment[] = [
      { type: 'good', durationSeconds: 30 },
      { type: 'bad',  durationSeconds: 10 },
      { type: 'good', durationSeconds: 20 },
    ]
    render(<PostureTimeline segments={segs} />)
    expect(screen.getAllByTestId('timeline-segment')).toHaveLength(3)
  })

  it('good 段使用绿色，bad 段使用橙色', () => {
    const segs: Segment[] = [
      { type: 'good', durationSeconds: 1 },
      { type: 'bad',  durationSeconds: 1 },
    ]
    const { container } = render(<PostureTimeline segments={segs} />)
    const blocks = container.querySelectorAll('[data-testid="timeline-segment"]')
    expect(blocks[0].classList).toContain('bg-green-400')
    expect(blocks[1].classList).toContain('bg-orange-400')
  })
})
