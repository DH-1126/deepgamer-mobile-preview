export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return (digits.length > 11 && digits.startsWith('86') ? digits.slice(2) : digits).slice(0, 11)
}

export function isValidMainlandPhone(value: string) {
  return /^1[3-9]\d{9}$/.test(normalizePhone(value))
}

export function normalizeCode(value: string) {
  return value.replace(/\D/g, '').slice(0, 6)
}

export function sanitizeReturnTo(value: string | null | undefined, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback
  try {
    const url = new URL(value, 'https://m.deepgamer.localhost')
    if (url.origin !== 'https://m.deepgamer.localhost') return fallback
    if (url.pathname === '/welcome' || url.pathname === '/login' || url.pathname.startsWith('/login/')) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return fallback }
}

export type LoginRouteMethod = 'one_tap' | 'code' | 'password'

export type WelcomePhase = 'splash' | 'agreement' | 'exit' | 'loading' | 'error'

export function getWelcomeFigmaNodeId(phase: WelcomePhase) {
  if (phase === 'agreement') return '3681:25465'
  if (phase === 'exit') return '3681:25569'
  return '3681:25436'
}

export function getLoginFigmaNodeId(method: LoginRouteMethod) {
  if (method === 'code') return '3681:36411'
  if (method === 'password') return '3681:36326'
  return '3681:24987'
}

export function formatLoginPhone(value: string) {
  const phone = normalizePhone(value)
  return phone.replace(/^(\d{3})(\d{1,4})?(\d{1,4})?$/, (_, first: string, middle?: string, last?: string) => [first, middle, last].filter(Boolean).join(' '))
}

export function buildLoginRoute(method: LoginRouteMethod, returnTo = '/', closeTo?: string) {
  const pathname = method === 'one_tap' ? '/login' : `/login/${method}`
  const params = new URLSearchParams()
  if (returnTo !== '/') params.set('returnTo', returnTo)
  if (closeTo) params.set('closeTo', closeTo)
  const search = params.toString()
  return search ? `${pathname}?${search}` : pathname
}

export function getCountdown(cooldownUntil: number, now = Date.now()) {
  return Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
}

export function maskPhone(value: string) {
  const phone = normalizePhone(value)
  return phone.length === 11 ? `${phone.slice(0, 3)} **** ${phone.slice(-4)}` : phone
}
