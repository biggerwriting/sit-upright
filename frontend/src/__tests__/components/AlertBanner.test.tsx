import { render, screen } from '@testing-library/react'
import { AlertBanner } from '@/components/detection/AlertBanner'

describe('AlertBanner', () => {
  it('show=false 时不渲染', () => {
    const { container } = render(<AlertBanner show={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('show=true 时显示警告文字', () => {
    render(<AlertBanner show={true} />)
    expect(screen.getByText('⚠ 请注意坐姿')).toBeInTheDocument()
  })
})
