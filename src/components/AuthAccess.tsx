import { createContext, useCallback, useContext, useSyncExternalStore, type PropsWithChildren, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authRepository } from '../repository/authRepository'
import { buildLoginRoute, sanitizeReturnTo } from './authModel'
import { isLinkedDataMode, isRestoredLinkedMode } from '../runtime/dataMode'
import { RestoredConnectionBoundary, useRestoredClient } from '../linked/RestoredClientProvider'

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
  const authenticated = useSyncExternalStore(authRepository.subscribe, authRepository.isAuthenticated, authRepository.isAuthenticated)
  const restored = useRestoredClient()
  if (isRestoredLinkedMode) return restored.status === 'ready' && restored.connection !== null && restored.transport !== null
  return isLinkedDataMode || authenticated
}

export function useAuthPrompt() {
  const value = useContext(AuthPromptContext)
  if (!value) throw new Error('useAuthPrompt must be used within AuthPromptProvider')
  return value
}

export function AuthPromptProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const location = useLocation()
  const restored = useRestoredClient()
  const requireAuth = useCallback((options: AuthPromptOptions) => {
    if (isRestoredLinkedMode) return restored.status === 'ready' && restored.connection !== null && restored.transport !== null
    if (isLinkedDataMode || authRepository.isAuthenticated()) return true
    const closeTo = `${location.pathname}${location.search}${location.hash}`
    navigate(buildLoginRoute('one_tap', sanitizeReturnTo(options.returnTo), closeTo))
    return false
  }, [location.hash, location.pathname, location.search, navigate, restored])

  return <AuthPromptContext.Provider value={{ requireAuth }}>{children}</AuthPromptContext.Provider>
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const authenticated = useAuthStatus()
  const location = useLocation()
  const returnTo = `${location.pathname}${location.search}${location.hash}`
  if (isRestoredLinkedMode) return <RestoredConnectionBoundary>{children}</RestoredConnectionBoundary>
  return authenticated ? <>{children}</> : <Navigate to={buildLoginRoute('one_tap', returnTo, '/')} replace />
}
