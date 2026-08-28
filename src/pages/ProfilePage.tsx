import { useEffect, useState, type MouseEvent } from 'react'
import { BadgeCheck, ChevronRight, Gamepad2, Headset, Home, LogOut, MessageSquare, RefreshCw, Settings, ShieldCheck, ShoppingBag, Store, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthPrompt, useAuthStatus } from '../components/AuthAccess'
import { buildLoginRoute } from '../components/authModel'
import { assetPath } from '../components/assetPath'
import { formatEntryBadge } from '../components/orderHubModel'
import { formatCountdown, formatMoney } from '../components/profileModel'
import { profileMoreEntries, profileUser } from '../data/profileFixtures'
import { favoriteRepository } from '../repository/favoriteRepository'
import { authRepository } from '../repository/authRepository'
import { orderRepository } from '../repository/orderRepository'
import { walletRepository } from '../repository/walletRepository'
import '../styles/profile-v2.css'

export function ProfilePage() {
  return useAuthStatus() ? <AuthenticatedProfilePage /> : <GuestProfilePage />
}

function GuestProfilePage() {
  const { requireAuth } = useAuthPrompt()
  const promptLogin = (returnTo: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (requireAuth({ title: '登录后体验完整服务', description: '登录后可使用卖号、消息、个人中心等完整服务。', returnTo })) return
    event.preventDefault()
  }
  return <main className="profile-v2-page profile-v2-guest" data-node-id="185:6414">
    <header className="profile-v2-guest-header">
      <div className="profile-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
      <span className="profile-v2-guest-mark" aria-hidden="true">DG</span>
      <h1>登录后管理你的交易</h1>
      <p>订单、求购、收藏和资金记录都在这里</p>
      <Link className="profile-v2-guest-login" to={buildLoginRoute('one_tap', '/profile', '/profile')}>手机号一键登录</Link>
    </header>
    <div className="profile-v2-guest-scroll">
      <section aria-labelledby="profile-login-note">
        <h2 id="profile-login-note">登录后可以做什么？</h2>
        <p>下单、发布商品、发布求购、快速回收和查看订单需要登录并完成实名认证。</p>
        <small>登录完成后，我们会自动带你回到刚才的操作。</small>
      </section>
      <div className="profile-v2-guest-public"><Link to="/feedback">吐槽广场<ChevronRight size={15} aria-hidden="true" /></Link><Link to="/user-agreement">用户服务协议<ChevronRight size={15} aria-hidden="true" /></Link><Link to="/privacy-policy">隐私政策<ChevronRight size={15} aria-hidden="true" /></Link></div>
    </div>
    <nav className="profile-v2-nav" aria-label="主导航"><Link to="/"><Home size={22} strokeWidth={1.8} aria-hidden="true" /><span>首页</span></Link><Link to="/game?gameCode=wzry"><Gamepad2 size={22} strokeWidth={1.8} aria-hidden="true" /><span>游戏</span></Link><Link className="featured" to="/sell" aria-label="卖号" onClick={promptLogin('/sell')}><b>卖</b></Link><Link to="/message" onClick={promptLogin('/message')}><MessageSquare size={22} strokeWidth={1.8} aria-hidden="true" /><span>消息</span></Link><Link className="active" to="/profile" aria-current="page" onClick={promptLogin('/profile')}><UserRound size={22} strokeWidth={2} aria-hidden="true" /><span>我的</span></Link></nav>
  </main>
}

function AuthenticatedProfilePage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState(() => {
    try { orderRepository.expire(); return orderRepository.list() } catch { return [] }
  })
  const [now, setNow] = useState(() => Date.now())
  const [toast, setToast] = useState('')
  const [favoriteCount, setFavoriteCount] = useState(() => {
    try { return favoriteRepository.list().length } catch { return profileUser.favoriteCount }
  })
  const [walletBalance, setWalletBalance] = useState(() => walletRepository.getSnapshot().availableCents)
  const pending = orders.filter((order) => order.role === 'buyer' && (order.status === 'pending' || order.status === 'bind_success'))
  const buyerPendingCount = pending.length
  const sellerPendingCount = orders.filter((order) => order.role === 'seller' && order.status === 'binding').length

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      try { orderRepository.expire(current) } catch { /* Keep the last usable order snapshot. */ }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    const syncOrders = () => { try { setOrders(orderRepository.list()) } catch { /* Keep the last usable order snapshot. */ } }
    syncOrders()
    return orderRepository.subscribe(syncOrders)
  }, [])
  useEffect(() => walletRepository.subscribe(() => setWalletBalance(walletRepository.getSnapshot().availableCents)), [])
  useEffect(() => {
    const syncFavorites = () => { try { setFavoriteCount(favoriteRepository.list().length) } catch { /* Preserve the last known count. */ } }
    syncFavorites()
    return favoriteRepository.subscribe(syncFavorites)
  }, [])
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])
  const copyId = async () => {
    let input: HTMLTextAreaElement | null = null
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(profileUser.managementId)
      else {
        input = document.createElement('textarea'); input.value = profileUser.managementId; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.appendChild(input); input.select()
        if (!document.execCommand('copy')) throw new Error('copy failed')
      }
      setToast('已复制')
    } catch { setToast('复制失败，请手动复制') } finally { input?.remove() }
  }

  const logout = () => {
    if (!authRepository.logout()) { setToast('退出失败，请重试'); return }
    navigate('/', { replace: true })
  }

  return <main className="profile-v2-page">
    <header className="profile-v2-header">
      <div className="profile-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
      <div className="profile-v2-user-row"><div className="profile-v2-user-main"><span className="profile-v2-avatar"><UserRound size={27} strokeWidth={1.8} aria-hidden="true" /></span><span className="profile-v2-user-copy"><b>{profileUser.name}</b><small><span title={profileUser.managementId}>ID {profileUser.managementId}</span><button type="button" onClick={copyId} aria-label={`复制管理ID ${profileUser.managementId}`}>复制</button></small></span></div></div>
      <div className="profile-v2-wallet"><Link to="/wallet" aria-label={`余额${formatMoney(walletBalance)}`}><b>{formatMoney(walletBalance)}</b><span>余额</span></Link><i /><Link to="/favorites" aria-label={`收藏${favoriteCount}件`}><b>{favoriteCount}</b><span>收藏</span></Link></div>
    </header>

    <div className="profile-v2-scroll">
      <section className="profile-v2-pending" aria-labelledby="pending-title"><h2 id="pending-title"><i />待处理 <b>{pending.length}</b> 件</h2>{pending.map((order) => {
        const isPayment = order.status === 'pending'
        const expiresAt = isPayment ? order.expiresAt : order.actionExpiresAt
        return <div key={order.id}><span><b>{isPayment ? '1 笔订单待付款' : '1 笔待确认收货'}</b><time dateTime={`PT${Math.max(0, Math.ceil(((expiresAt ?? now) - now) / 1000))}S`}>剩 {formatCountdown(expiresAt, now)}</time></span><Link className={isPayment ? 'primary' : ''} to={`/orders?role=buyer&status=${order.status}`}>{isPayment ? '去支付' : '去查看'}</Link></div>
      })}</section>

      <section className="profile-v2-order-hub" aria-labelledby="profile-order-title">
        <h2 id="profile-order-title">我的交易</h2>
        <div>
          <OrderEntry label="我买到的" route="/orders?role=buyer" count={buyerPendingCount} icon={<ShoppingBag size={22} strokeWidth={1.8} aria-hidden="true" />} />
          <OrderEntry label="我卖出的" route="/orders?role=seller" count={sellerPendingCount} icon={<Store size={22} strokeWidth={1.8} aria-hidden="true" />} />
          <OrderEntry label="我的售后" route="/aftersales" count={0} icon={<Headset size={22} strokeWidth={1.8} aria-hidden="true" />} />
          <OrderEntry label="账号回收" route="/sell" count={0} icon={<RefreshCw size={22} strokeWidth={1.8} aria-hidden="true" />} />
        </div>
      </section>

      <section className="profile-v2-more" aria-labelledby="more-title"><h2 id="more-title">更多功能</h2><div className="profile-v2-feature-list">{profileMoreEntries.filter((entry) => entry.action !== 'logout').map((entry) => {
        const content = <><span className="profile-v2-feature-icon" aria-hidden="true"><FeatureIcon label={entry.label} /></span><span className="profile-v2-feature-title"><b>{entry.label}</b>{entry.badge && <em>{entry.badge}</em>}</span></>
        return <Link className="profile-v2-feature-row" key={entry.label} to={entry.route!}>{content}{entry.status && <small>{entry.status}</small>}<ChevronRight size={16} aria-hidden="true" /></Link>
      })}</div><div className="profile-v2-feature-list profile-v2-logout-list"><button type="button" className="profile-v2-feature-row" onClick={logout}><span className="profile-v2-feature-icon" aria-hidden="true"><LogOut size={18} /></span><b>退出登录</b></button></div></section>
    </div>

    <nav className="profile-v2-nav" aria-label="主导航"><Link to="/"><Home size={22} strokeWidth={1.8} aria-hidden="true" /><span>首页</span></Link><Link to="/game?gameCode=wzry"><Gamepad2 size={22} strokeWidth={1.8} aria-hidden="true" /><span>游戏</span></Link><Link className="featured" to="/sell" aria-label="卖号"><b>卖</b></Link><Link to="/message"><MessageSquare size={22} strokeWidth={1.8} aria-hidden="true" /><span>消息</span></Link><Link className="active" to="/profile" aria-current="page"><UserRound size={22} strokeWidth={2} aria-hidden="true" /><span>我的</span></Link></nav>
    {toast && <div className="profile-v2-toast" role="status">{toast}</div>}
  </main>
}

function FeatureIcon({ label }: { label: string }) {
  if (label === '卖家签约') return <Store size={18} />
  if (label === '实名认证') return <BadgeCheck size={18} />
  if (label === '设置') return <Settings size={18} />
  if (label === '隐私与协议') return <ShieldCheck size={18} />
  return <LogOut size={18} />
}

function OrderEntry({ label, route, count, icon }: { label: string; route: string; count: number; icon: React.ReactNode }) {
  return <Link to={route} aria-label={`${label}${count > 0 ? `，${count}项待处理` : ''}`}>
    <span aria-hidden="true">{icon}</span>
    <b>{label}</b>
    {count > 0 && <em aria-label={`${count}项待处理`}>{formatEntryBadge(count)}</em>}
  </Link>
}
