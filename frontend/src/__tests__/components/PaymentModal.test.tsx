// frontend/src/__tests__/components/PaymentModal.test.tsx
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentModal } from '@/components/payment/PaymentModal'
import { api } from '@/lib/api'

jest.mock('@/lib/api', () => ({
  api: { payment: { getOrder: jest.fn() } },
}))
jest.mock('next/navigation', () => ({ useRouter: jest.fn(() => ({ push: jest.fn() })) }))
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => (
    <div data-testid="qr-code" data-value={value} />
  ),
}))

const mockedApi = api as jest.Mocked<typeof api>

describe('PaymentModal', () => {
  const defaultProps = {
    orderId: 'order-123',
    qrCode: 'https://qr.alipay.com/test',
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  }

  beforeEach(() => jest.clearAllMocks())

  it('渲染二维码和价格', () => {
    mockedApi.payment.getOrder.mockResolvedValue({ id: 'order-123', status: 'pending' })
    render(<PaymentModal {...defaultProps} />)
    expect(screen.getByTestId('qr-code')).toBeInTheDocument()
    expect(screen.getByText(/¥9.9/)).toBeInTheDocument()
    expect(screen.getByText(/等待支付/)).toBeInTheDocument()
  })

  it('显示等待状态时轮询 getOrder', async () => {
    mockedApi.payment.getOrder.mockResolvedValue({ id: 'order-123', status: 'pending' })
    jest.useFakeTimers()
    render(<PaymentModal {...defaultProps} />)
    act(() => { jest.advanceTimersByTime(3000) })
    await waitFor(() => expect(mockedApi.payment.getOrder).toHaveBeenCalledWith('order-123'))
    jest.useRealTimers()
  })

  it('支付成功时调用 onSuccess', async () => {
    mockedApi.payment.getOrder
      .mockResolvedValueOnce({ id: 'order-123', status: 'pending' })
      .mockResolvedValueOnce({ id: 'order-123', status: 'paid' })
    jest.useFakeTimers()
    render(<PaymentModal {...defaultProps} />)
    act(() => { jest.advanceTimersByTime(3000) })
    act(() => { jest.advanceTimersByTime(3000) })
    await waitFor(() => expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1))
    jest.useRealTimers()
  })

  it('点击关闭按钮调用 onClose', async () => {
    mockedApi.payment.getOrder.mockResolvedValue({ id: 'order-123', status: 'pending' })
    render(<PaymentModal {...defaultProps} />)
    await userEvent.click(screen.getByRole('button', { name: /关闭/ }))
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })
})
