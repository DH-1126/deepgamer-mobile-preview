import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStatus } from './AuthAccess'
import { buildLoginRoute } from './authModel'
import { Button } from './ui'
import '../styles/login-floating-bar.css'

/** One visual and fixed position for guest prompts across browsing pages. */
export function LoginFloatingBar({ onLogin, placement = 'fixed' }: { onLogin: () => void; placement?: 'fixed' | 'flow' }) {
  return <aside className={`home-draft3-login-bar guest-login-bar-home home-draft3-login-bar--dark${placement === 'flow' ? ' home-draft3-login-bar--flow' : ''}`} aria-label="登录引导">
    <span className="home-draft3-gift" aria-hidden="true"><i>¥</i></span>
    <strong>人人都是深度玩家，登陆领取更多优惠</strong>
    <Button size="sm" onClick={onLogin}>登录</Button>
  </aside>
}

/** For pages without BottomNav; closing login returns to the same browsing route. */
export function GuestLoginFloatingBar({ returnTo }: { returnTo?: string } = {}) {
  const authenticated = useAuthStatus()
  const location = useLocation()
  const navigate = useNavigate()
  const currentPath = returnTo ?? location.pathname + location.search + location.hash

  return authenticated ? null : <LoginFloatingBar onLogin={() => navigate(buildLoginRoute('one_tap', currentPath, currentPath))} />
}
