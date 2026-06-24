import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

jest.mock('@/lib/api', () => ({
  api: {
    auth: {
      me: jest.fn(),
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
    },
  },
}))

const mockedApi = api as jest.Mocked<typeof api>

function TestComponent() {
  const { user, loading, login, logout } = useAuth()
  if (loading) return <p>loading</p>
  if (!user) return <button onClick={() => login('a@b.com', 'pass')}>login</button>
  return (
    <>
      <p>{user.email}</p>
      <button onClick={logout}>logout</button>
    </>
  )
}

describe('AuthContext', () => {
  beforeEach(() => jest.clearAllMocks())

  it('loads user from /auth/me on mount', async () => {
    mockedApi.auth.me.mockResolvedValue({ id: 1, email: 'a@b.com' })
    render(<AuthProvider><TestComponent /></AuthProvider>)
    expect(screen.getByText('loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('a@b.com')).toBeInTheDocument())
  })

  it('sets user=null when /auth/me fails', async () => {
    mockedApi.auth.me.mockRejectedValue(new Error('API error 401'))
    render(<AuthProvider><TestComponent /></AuthProvider>)
    await waitFor(() => expect(screen.getByText('login')).toBeInTheDocument())
  })

  it('login sets user', async () => {
    mockedApi.auth.me.mockRejectedValue(new Error('API error 401'))
    mockedApi.auth.login.mockResolvedValue({ id: 1, email: 'a@b.com' })
    render(<AuthProvider><TestComponent /></AuthProvider>)
    await waitFor(() => screen.getByText('login'))
    await userEvent.click(screen.getByText('login'))
    await waitFor(() => expect(screen.getByText('a@b.com')).toBeInTheDocument())
  })

  it('logout clears user', async () => {
    mockedApi.auth.me.mockResolvedValue({ id: 1, email: 'a@b.com' })
    mockedApi.auth.logout.mockResolvedValue(undefined)
    render(<AuthProvider><TestComponent /></AuthProvider>)
    await waitFor(() => screen.getByText('a@b.com'))
    await userEvent.click(screen.getByText('logout'))
    await waitFor(() => expect(screen.getByText('login')).toBeInTheDocument())
  })
})
