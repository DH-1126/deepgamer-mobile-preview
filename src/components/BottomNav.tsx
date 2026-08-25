import { Gamepad2, Home, MessageCircle, PlusCircle, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { buildLoginRoute } from './authModel'
import { useAuthPrompt, useAuthStatus } from './AuthAccess'
import { assetPath } from './assetPath'

const items = [
  { label: '首页', href: '/', icon: Home },
  { label: '游戏', href: '/game?gameCode=wzry', icon: Gamepad2 },
  { label: '卖号', href: '/sell', icon: PlusCircle, featured: true },
  { label: '消息', href: '/message', icon: MessageCircle },
  { label: '我的', href: '/profile', icon: UserRound },
]

function GuestLoginBar({ variant, onLogin }: { variant: 'default' | 'home' | 'catalog'; onLogin: () => void }) {
  return <aside className={`guest-login-bar guest-login-bar-${variant}`} data-node-id="159:2667">
    <span>快来登录吧，一起成为深度玩家！</span>
    <button type="button" onClick={onLogin}>登录</button>
  </aside>
}

export function BottomNav({ variant = 'default', gameCode = 'wzry', gameName = '王者荣耀', showGuestPrompt = true }: { variant?: 'default' | 'home' | 'catalog'; gameCode?: string; gameName?: string; showGuestPrompt?: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const authenticated = useAuthStatus()
  const { requireAuth } = useAuthPrompt()
  const currentPath = `${location.pathname}${location.search}${location.hash}`
  const openLogin = () => navigate(buildLoginRoute('one_tap', currentPath, currentPath))
  const protectedClick = (href: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (requireAuth({ title: '登录后体验完整服务', description: '登录后可使用卖号、消息、个人中心等完整服务。', returnTo: href })) return
    event.preventDefault()
  }
  const guestBar = !authenticated && showGuestPrompt ? <GuestLoginBar variant={variant} onLogin={openLogin} /> : null
  if (variant === 'home') {
    const homeItems = [
      { label: '首页', href: '/', icon: assetPath('assets/home-v2/nav-home.svg') },
      { label: '买号', href: '/game?gameCode=wzry', icon: assetPath('assets/home-v2/nav-buy.svg') },
      { label: '卖', href: '/sell', featured: true },
      { label: '消息', href: '/message', icon: assetPath('assets/home-v2/nav-message.svg') },
      { label: '我的', href: '/profile', icon: assetPath('assets/home-v2/nav-profile.svg') },
    ]
    return <>
      {guestBar}
      <nav className="bottom-nav bottom-nav-home" aria-label="主导航">
        {homeItems.map(({ label, href, icon, featured }) => {
          const active = href === '/' ? location.pathname === '/' : location.pathname.startsWith(href.split('?')[0])
          const requiresLogin = href === '/sell' || href === '/message' || href === '/profile'
          return <Link key={label} to={href} onClick={requiresLogin ? protectedClick(href) : undefined} className={`${active ? 'active' : ''} ${featured ? 'featured' : ''}`} aria-current={active ? 'page' : undefined}>{featured ? <span className="home-sell-mark">卖</span> : <><img src={icon} alt="" /><span>{label}</span></>}</Link>
        })}
      </nav>
    </>
  }
  if (variant === 'catalog') {
    const catalogItems = [
      { label: '首页', href: '/', icon: assetPath('assets/catalog-v2/nav-home.svg') },
      { label: gameName, href: `/game?gameCode=${gameCode}`, icon: assetPath('assets/catalog-v2/nav-game.svg') },
      { label: '卖', href: '/sell', featured: true },
      { label: '消息', href: '/message', icon: assetPath('assets/catalog-v2/nav-message.svg') },
      { label: '我的', href: '/profile', icon: assetPath('assets/catalog-v2/nav-profile.svg') },
    ]
    return <>{guestBar}<nav className="bottom-nav bottom-nav-catalog" aria-label="主导航">{catalogItems.map(({ label, href, icon, featured }, index) => {
      const requiresLogin = href === '/sell' || href === '/message' || href === '/profile'
      return <Link key={label} to={href} onClick={requiresLogin ? protectedClick(href) : undefined} className={`${index === 1 ? 'active' : ''} ${featured ? 'featured' : ''}`} aria-current={index === 1 ? 'page' : undefined}>{featured ? <span className="catalog-sell-mark">卖</span> : <><img src={icon} alt="" /><span>{label}</span></>}</Link>
    })}</nav></>
  }
  return <>
    {guestBar}
    <nav className="bottom-nav" aria-label="主导航">
      {items.map(({ label, href, icon: Icon, featured }) => {
        const active = href === '/' ? location.pathname === '/' : location.pathname.startsWith(href.split('?')[0])
        const requiresLogin = href === '/sell' || href === '/message' || href === '/profile'
        return (
          <Link key={label} to={href} onClick={requiresLogin ? protectedClick(href) : undefined} className={`${active ? 'active' : ''} ${featured ? 'featured' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="nav-icon"><Icon size={featured ? 25 : 21} strokeWidth={2.1} /></span>
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  </>
}
