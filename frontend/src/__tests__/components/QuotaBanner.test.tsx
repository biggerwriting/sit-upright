import { render, screen } from '@testing-library/react'
import { QuotaBanner } from '@/components/detection/QuotaBanner'

describe('QuotaBanner', () => {
  it('显示剩余分钟数', () => {
    render(<QuotaBanner remainingSeconds={300} nearExpiry={null} />)
    expect(screen.getByText(/剩余用量：5 分钟/)).toBeInTheDocument()
  })

  it('配额为 0 时显示购买入口', () => {
    render(<QuotaBanner remainingSeconds={0} nearExpiry={null} />)
    expect(screen.getByText(/购买套餐/)).toBeInTheDocument()
  })

  it('nearExpiry 不为 null 时显示 ⚠ 预警', () => {
    render(
      <QuotaBanner
        remainingSeconds={300}
        nearExpiry={{ seconds: 300, expiresAt: '2026-06-27T10:00:00Z' }}
      />
    )
    expect(screen.getByText(/⚠/)).toBeInTheDocument()
    expect(screen.getByText(/6月27日/)).toBeInTheDocument()
  })

  it('nearExpiry 为 null 时不显示预警', () => {
    const { container } = render(
      <QuotaBanner remainingSeconds={300} nearExpiry={null} />
    )
    expect(container.querySelector('[data-testid="near-expiry"]')).toBeNull()
  })
})
