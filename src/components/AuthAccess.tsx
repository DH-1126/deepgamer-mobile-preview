import { createContext, useCallback, useContext, useSyncExternalStore, type PropsWithChildren, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authRepository } from '../repository/authRepository'
import { buildLoginRoute, sanitizeReturnTo } from './authModel'

type AuthPromptOptions = {
  title?: string
  description: string
  returnTo: string
}

type AuthPromptContextValue = {
  requireAuth: (options: AuthPromptOptions) => boolean
}

const AuthPromptContext = createContext<AuthPromptContextValue | null>(null)

export function useAuthStatus() {
  return useSyncExternalStore(authRepository.subscribe, authRepository.isAuthenticated, authRepository.isAuthenticated)
}

export function useAuthPrompt() {
  const value = useContext(AuthPromptContext)
  if (!value) throw new Error('useAuthPrompt must be used within AuthPromptProvider')
  return value
}

export function AuthPromptProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const location = useLocation()
  const requireAuth = useCallback((options: AuthPromptOptions) => {
    if (authRepository.isAuthenticated()) return true
    const closeTo = `${location.pathname}${location.search}${location.hash}`
    navigate(buildLoginRoute('one_tap', sanitizeReturnTo(options.returnTo), closeTo))
    return false
  }, [location.hash, location.pathname, location.search, navigate])

  return <AuthPromptContext.Provider value={{ requireAuth }}>{children}</AuthPromptContext.Provider>
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const authenticated = useAuthStatus()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}${location.hash}`
  return authenticated ? <>{children}</> : <Navigate to={buildLoginRoute('one_tap', returnTo, '/')} replace />
}
