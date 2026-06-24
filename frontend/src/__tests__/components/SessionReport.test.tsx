// frontend/src/__tests__/components/SessionReport.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionReport } from '@/components/detection/SessionReport'
import type { SessionStats } from '@/types'

const stats: SessionStats = {
  totalSeconds: 60,
  goodSeconds: 45,
  badSeconds: 15,
  segments: [
    { type: 'good', durationSeconds: 45 },
    { type: 'bad',  durationSeconds: 15 },
  ],
}

describe('SessionReport', () => {
  it('显示总时长', () => {
    render(<SessionReport stats={stats} onClose={() => {}} />)
    expect(screen.getByText(/本次检测：1 分 0 秒/)).toBeInTheDocument()
  })

  it('显示优秀坐姿时长和占比', () => {
    render(<SessionReport stats={stats} onClose={() => {}} />)
    expect(screen.getByText(/优秀坐姿：45 秒/)).toBeInTheDocument()
    expect(screen.getByText(/75%/)).toBeInTheDocument()
  })

  it('点击关闭按钮调用 onClose', async () => {
    const onClose = jest.fn()
    render(<SessionReport stats={stats} onClose={onClose} />)
    await userEvent.click(screen.getByText('关闭'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
