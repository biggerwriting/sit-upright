import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SignupPage from '@/app/signup/page'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))

const mockSignup = jest.fn()
const mockPush = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(useAuth as jest.Mock).mockReturnValue({ signup: mockSignup, user: null, loading: false })
  ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
})

describe('SignupPage', () => {
  it('renders email and password fields', () => {
    render(<SignupPage />)
    expect(screen.getByPlaceholderText('邮箱')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('密码（至少 8 位）')).toBeInTheDocument()
  })

  it('calls signup and redirects on success', async () => {
    mockSignup.mockResolvedValue(undefined)
    render(<SignupPage />)
    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'new@b.com')
    await userEvent.type(screen.getByPlaceholderText('密码（至少 8 位）'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: '注册' }))
    await waitFor(() => expect(mockSignup).toHaveBeenCalledWith('new@b.com', 'password123'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/app'))
  })

  it('shows error on signup failure', async () => {
    mockSignup.mockRejectedValue(new Error('API error 400'))
    render(<SignupPage />)
    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'taken@b.com')
    await userEvent.type(screen.getByPlaceholderText('密码（至少 8 位）'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: '注册' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
