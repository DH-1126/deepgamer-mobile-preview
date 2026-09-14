import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { MouseEvent } from 'react'
import { buildLoginRoute } from './authModel'
import { useAuthPrompt, useAuthStatus } from './AuthAccess'
import { assetPath } from './assetPath'
import { LoginFloatingBar } from './LoginFloatingBar'
import { CountBadge } from './ui'
import { useMessageUnreadCount } from './useMessageState'
import { usePendingOrderSummary } from './usePendingOrderSummary'
import './bottom-nav.css'

export type NavKey = 'home' | 'catalog' | 'sell' | 'message' | 'profile'
export type BottomNavItem = { key: NavKey; label: string; href: string; icon?: string; requiresLogin?: boolean; badgeCount?: number }
type BottomNavProps = {
  /** Variants only configure business context; all pages share the homepage visual style. */
  variant?: 'default' | 'home' | 'catalog'
  placement?: 'fixed' | 'absolute' | 'flow'
  gameCode?: string
  gameName?: string
  showGuestPrompt?: boolean
}

export function getActiveNavKey(pathname: string): NavKey | undefined {
  if (pathname === '/') return 'home'
  if (pathname === '/game' || pathname.startsWith('/game/')) return 'catalog'
  if (pathname === '/sell' || pathname.startsWith('/sell/')) return 'sell'
  if (['/message', '/notifications', '/im'].some(path => pathname === path || pathname.startsWith(path + '/'))) return 'message'
  if (pathname === '/profile' || pathname.startsWith('/profile/')) return 'profile'
  return undefined
}

export function BottomNav({ variant = 'home', placement = variant === 'catalog' ? 'absolute' : 'fixed', gameCode = 'wzry', gameName = '王者荣耀', showGuestPrompt = true }: BottomNavProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const authenticated = useAuthStatus()
  const unreadCount = useMessageUnreadCount()
  const { totalPendingCount } = usePendingOrderSummary()
  const { requireAuth } = useAuthPrompt()
  const currentPath = location.pathname + location.search + location.hash
  const openLogin = () => navigate(buildLoginRoute('one_tap', currentPath, currentPath))
  const activeKey = getActiveNavKey(location.pathname)
  const items: BottomNavItem[] = [
    { key: 'home', label: '首页', href: '/', icon: 'nav-home.svg' },
    { key: 'catalog', label: variant === 'catalog' ? gameName : '买号', href: '/game?gameCode=' + encodeURIComponent(gameCode), icon: 'nav-buy.svg' },
    { key: 'sell', label: '卖', href: '/sell', requiresLogin: true },
    { key: 'message', label: '消息', href: '/message', icon: 'nav-message.svg', requiresLogin: true, badgeCount: unreadCount },
    { key: 'profile', label: '我的', href: '/profile', icon: 'nav-profile.svg', requiresLogin: true, badgeCount: totalPendingCount },
  ]

  return <>
    {!authenticated && showGuestPrompt && <LoginFloatingBar onLogin={openLogin} />}
    <BottomNavView items={items} activeKey={activeKey} placement={placement} onNavigate={(event, item) => {
      if (item.requiresLogin && !requireAuth({ title: '登录后体验完整服务', description: '登录后可使用卖号、消息、个人中心等完整服务。', returnTo: item.href })) event.preventDefault()
    }} />
  </>
}

/** Pure presentation: consumers own routing, authentication and badge counts. */
export function BottomNavView({ items, activeKey, placement = 'flow', onNavigate }: {
  items: BottomNavItem[]
  activeKey?: NavKey
  placement?: BottomNavProps['placement']
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>, item: BottomNavItem) => void
}) {
  return <nav data-ui="BottomNav" className={'dg-bottom-nav dg-bottom-nav--' + placement} aria-label="主导航">
      {items.map(item => {
        const { key, label, href, icon, badgeCount = 0 } = item
        return <Link key={key} to={href}
        className={'dg-bottom-nav__item' + (activeKey === key ? ' active' : '') + (key === 'sell' ? ' featured' : '')}
        aria-current={activeKey === key ? 'page' : undefined}
        onClick={event => onNavigate?.(event, item)}>
        {key === 'sell' ? <span className="dg-bottom-nav__sell">卖</span> : <>
          <span className="dg-bottom-nav__icon-wrap">
            <span className="dg-bottom-nav__icon" aria-hidden="true" style={{ maskImage: 'url("' + assetPath('assets/home-v2/' + icon) + '")', WebkitMaskImage: 'url("' + assetPath('assets/home-v2/' + icon) + '")' }} />
            {badgeCount > 0 && <span className="dg-bottom-nav__badge"><CountBadge count={badgeCount} /></span>}
          </span>
          <span className="dg-bottom-nav__label">{label}</span>
        </>}
      </Link>})}
    </nav>
}
