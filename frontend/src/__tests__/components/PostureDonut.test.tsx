// frontend/src/__tests__/components/PostureDonut.test.tsx
import { render, screen } from '@testing-library/react'
import { PostureDonut } from '@/components/detection/PostureDonut'

describe('PostureDonut', () => {
  it('显示优秀坐姿和不良坐姿标签', () => {
    render(<PostureDonut goodSeconds={40} badSeconds={20} />)
    expect(screen.getByText('优秀坐姿')).toBeInTheDocument()
    expect(screen.getByText('不良坐姿')).toBeInTheDocument()
  })

  it('全为 0 时显示 0% 不良', () => {
    render(<PostureDonut goodSeconds={0} badSeconds={0} />)
    expect(screen.getByTestId('bad-pct').textContent).toBe('0%')
  })

  it('badSeconds=20 goodSeconds=60 时显示 25% 不良', () => {
    render(<PostureDonut goodSeconds={60} badSeconds={20} />)
    expect(screen.getByTestId('bad-pct').textContent).toBe('25%')
  })
})
