import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { ChevronRight, Gamepad2, Heart, Home, MessageSquare, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthPrompt, useAuthStatus } from '../components/AuthAccess'
import { buildLoginRoute } from '../components/authModel'
import { assetPath } from '../components/assetPath'
import { buildOrderRoute, countOrders, formatCountdown, formatMoney, getPendingOrders } from '../components/profileModel'
import { createProfileOrders, profileMoreEntries, profileUser, recycleChoices } from '../data/profileFixtures'
import type { ProfileOrderStatus } from '../types/profile'
import { favoriteRepository } from '../repository/favoriteRepository'
import '../styles/profile-v2.css'

const buyerCards: Array<{ label: string; status: ProfileOrderStatus }> = [
  { label: '待付款', status: 'pending' }, { label: '换绑中', status: 'binding' }, { label: '待确认', status: 'bind_success' }, { label: '售后', status: 'aftersale' },
]
const sellerCards: Array<{ label: string; status: ProfileOrderStatus; route?: string }> = [
  { label: '在售', status: 'on_sale', route: '/sell/goods?status=on_sale' }, { label: '审核中', status: 'reviewing', route: '/sell/goods?status=reviewing' }, { label: '待换绑', status: 'binding' }, { label: '售后', status: 'aftersale' },
]

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
  const [orders] = useState(() => createProfileOrders(Date.now()))
  const [now, setNow] = useState(() => Date.now())
  const [recycleOpen, setRecycleOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [favoriteCount, setFavoriteCount] = useState(() => {
    try { return favoriteRepository.list().length } catch { return profileUser.favoriteCount }
  })
  const dialogRef = useRef<HTMLElement>(null)
  const closeRecycle = useCallback(() => setRecycleOpen(false), [])
  const pending = getPendingOrders(orders)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
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
  useEffect(() => {
    if (!recycleOpen) return undefined
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusables = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]') ?? [])]
    requestAnimationFrame(() => focusables()[0]?.focus())
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRecycle(); return }
      if (event.key !== 'Tab') return
      const items = focusables(); if (!items.length) return
      const first = items[0]; const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); document.body.style.overflow = oldOverflow; previous?.focus() }
  }, [closeRecycle, recycleOpen])

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

  return <main className="profile-v2-page">
    <header className="profile-v2-header">
      <div className="profile-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
      <div className="profile-v2-user-row"><Link className="profile-v2-user-main" to="/settings" aria-label={`${profileUser.name}，${profileUser.loginStatus}，进入设置`}><span className="profile-v2-avatar"><UserRound size={27} strokeWidth={1.8} aria-hidden="true" /></span><span className="profile-v2-user-copy"><b>{profileUser.name}</b><small><em>{profileUser.loginStatus}</em><span title={profileUser.managementId}>ID {profileUser.managementId}</span></small></span></Link><button type="button" onClick={copyId} aria-label={`复制管理ID ${profileUser.managementId}`}>复制</button><Link to="/settings" aria-label="进入设置"><ChevronRight size={17} strokeWidth={2} aria-hidden="true" /></Link></div>
      <div className="profile-v2-wallet"><Link to="/wallet" aria-label={`余额${formatMoney(profileUser.balanceCents)}`}><b>{formatMoney(profileUser.balanceCents)}</b><span>余额</span></Link><i /><Link to="/favorites" aria-label={`收藏${favoriteCount}件`}><b>{favoriteCount}</b><span>收藏</span></Link></div>
    </header>

    <div className="profile-v2-scroll">
      <section className="profile-v2-pending" aria-labelledby="pending-title"><h2 id="pending-title"><i />待处理 <b>{pending.length}</b> 件</h2>{pending.map((order) => {
        const isPayment = order.status === 'pending'
        return <div key={order.id}><span><b>{isPayment ? '1 笔订单待付款' : '1 笔待确认收货'}</b><time dateTime={`PT${Math.max(0, Math.ceil(((order.expiresAt ?? now) - now) / 1000))}S`}>剩 {formatCountdown(order.expiresAt, now)}</time></span><Link className={isPayment ? 'primary' : ''} to={buildOrderRoute('buyer', order.status)}>{isPayment ? '去支付' : '去查看'}</Link></div>
      })}</section>

      <OrderGroup title="我买到的" allRoute={buildOrderRoute('buyer')} cards={buyerCards.map((card) => ({ ...card, count: countOrders(orders, 'buyer', card.status), route: buildOrderRoute('buyer', card.status) }))} />
      <OrderGroup title="我卖出的" allRoute={buildOrderRoute('seller')} cards={sellerCards.map((card) => ({ ...card, count: countOrders(orders, 'seller', card.status), route: card.route ?? buildOrderRoute('seller', card.status) }))} />

      <section className="profile-v2-more" aria-labelledby="more-title"><h2 id="more-title">更多</h2><div>{profileMoreEntries.map((entry) => entry.action === 'recycle'
        ? <button type="button" key={entry.label} aria-haspopup="dialog" aria-expanded={recycleOpen} onClick={() => setRecycleOpen(true)}>{entry.label}</button>
        : <Link key={entry.label} to={entry.route!}>{entry.label}{entry.badge && <small>{entry.badge}</small>}{entry.dot && <i aria-hidden="true" />}</Link>)}</div></section>
    </div>

    <nav className="profile-v2-nav" aria-label="主导航"><Link to="/"><Home size={22} strokeWidth={1.8} aria-hidden="true" /><span>首页</span></Link><Link to="/game?gameCode=wzry"><Gamepad2 size={22} strokeWidth={1.8} aria-hidden="true" /><span>游戏</span></Link><button type="button" aria-label="卖号" aria-haspopup="dialog" aria-expanded={recycleOpen} onClick={() => setRecycleOpen(true)}><b>卖</b></button><Link to="/message"><MessageSquare size={22} strokeWidth={1.8} aria-hidden="true" /><span>消息</span></Link><Link className="active" to="/profile" aria-current="page"><UserRound size={22} strokeWidth={2} aria-hidden="true" /><span>我的</span></Link></nav>

    {recycleOpen && <div className="profile-v2-dialog-layer"><button type="button" className="profile-v2-dialog-mask" aria-label="关闭卖号选择" onClick={closeRecycle} /><section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="recycle-title"><header><h2 id="recycle-title">选择卖号方式</h2><button type="button" onClick={closeRecycle} aria-label="关闭">×</button></header><div>{recycleChoices.map((choice) => <Link key={choice.route} to={choice.route}><span><b>{choice.label}</b><small>{choice.detail}</small></span><ChevronRight size={18} aria-hidden="true" /></Link>)}</div></section></div>}
    {toast && <div className="profile-v2-toast" role="status">{toast}</div>}
  </main>
}

function OrderGroup({ title, allRoute, cards }: { title: string; allRoute: string; cards: Array<{ label: string; count: number; route: string }> }) {
  return <section className="profile-v2-orders" aria-label={title}><header><h2>{title}</h2><Link to={allRoute}>全部<ChevronRight size={12} aria-hidden="true" /></Link></header><div>{cards.map((card) => <Link className={`${card.count === 0 ? 'empty' : ''} ${card.label === '待付款' ? 'danger' : card.label === '待确认' ? 'warning' : ''}`} key={card.label} to={card.route} aria-label={`${card.label}${card.count}项`}><b>{card.count}</b><span>{card.label}</span></Link>)}</div></section>
}
