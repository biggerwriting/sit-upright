import { render, screen } from '@testing-library/react'
import { QuotaBanner } from '@/components/detection/QuotaBanner'

describe('QuotaBanner', () => {
  it('显示剩余分钟数', () => {
    render(<QuotaBanner remainingSeconds={300} />)
    expect(screen.getByText(/剩余用量：5 分钟/)).toBeInTheDocument()
  })

  it('配额为 0 时显示购买入口', () => {
    render(<QuotaBanner remainingSeconds={0} />)
    expect(screen.getByText(/购买套餐/)).toBeInTheDocument()
  })
})
