import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/login/page'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'

jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))

const mockLogin = jest.fn()
const mockPush = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  ;(useAuth as jest.Mock).mockReturnValue({ login: mockLogin, user: null, loading: false })
  ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
})

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    render(<LoginPage />)
    expect(screen.getByPlaceholderText('邮箱')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
  })

  it('calls login and redirects on success', async () => {
    mockLogin.mockResolvedValue(undefined)
    render(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'a@b.com')
    await userEvent.type(screen.getByPlaceholderText('密码'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'password123'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/app'))
  })

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValue(new Error('API error 401'))
    render(<LoginPage />)
    await userEvent.type(screen.getByPlaceholderText('邮箱'), 'a@b.com')
    await userEvent.type(screen.getByPlaceholderText('密码'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
