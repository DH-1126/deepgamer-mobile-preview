import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import {
  BadgeCheck,
  ChevronRight,
  Copy,
  Gamepad2,
  Home,
  LogOut,
  MessageSquare,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserRound,
  X,
} from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthPrompt, useAuthStatus } from '../components/AuthAccess'
import { buildLoginRoute } from '../components/authModel'
import { assetPath } from '../components/assetPath'
import { formatEntryBadge } from '../components/orderHubModel'
import { formatCountdown, formatMoney } from '../components/profileModel'
import { profileMoreEntries, profileUser } from '../data/profileFixtures'
import { authRepository } from '../repository/authRepository'
import { favoriteRepository } from '../repository/favoriteRepository'
import { orderRepository } from '../repository/orderRepository'
import { walletRepository } from '../repository/walletRepository'
import '../styles/profile-v2.css'

type SellerState = 'buyer' | 'signing' | 'review' | 'seller'

const sellerStates: Record<SellerState, { title: string; badge: string; description: string; action: string; tone: string }> = {
  buyer: { title: '成为卖家', badge: '未签约', description: '完成卖家签约后即可发布账号并收款', action: '去签约', tone: 'buyer' },
  signing: { title: '卖家签约', badge: '待完成', description: '还差 2 步 · 协议签署、收款信息', action: '继续签约', tone: 'signing' },
  review: { title: '卖家认证', badge: '审核中', description: '平台审核中，预计 1 个工作日', action: '查看进度', tone: 'review' },
  seller: { title: '卖家中心', badge: '已签约', description: '2 个在售 · 1 个审核中 · 1 个待换绑', action: '进入卖家中心', tone: 'seller' },
}

export function ProfilePage() {
  return useAuthStatus() ? <AuthenticatedProfilePage /> : <GuestProfilePage />
}

function StatusBar({ muted = false }: { muted?: boolean }) {
  return <div className={`profile-v2-status${muted ? ' muted' : ''}`} aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
}

function MainNav({ promptLogin }: { promptLogin?: (returnTo: string) => (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return <nav className="profile-v2-nav" aria-label="主导航">
    <Link to="/"><Home size={22} strokeWidth={1.8} aria-hidden="true" /><span>首页</span></Link>
    <Link to="/game?gameCode=wzry"><Gamepad2 size={22} strokeWidth={1.8} aria-hidden="true" /><span>买号</span></Link>
    <Link className="featured" to="/sell" aria-label="卖号" onClick={promptLogin?.('/sell')}><b>卖</b></Link>
    <Link to="/message" onClick={promptLogin?.('/message')}><MessageSquare size={22} strokeWidth={1.8} aria-hidden="true" /><span>消息</span></Link>
    <Link className="active" to="/profile" aria-current="page"><UserRound size={22} strokeWidth={2} aria-hidden="true" /><span>我的</span></Link>
  </nav>
}

function GuestProfilePage() {
  const { requireAuth } = useAuthPrompt()
  const promptLogin = (returnTo: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (requireAuth({ title: '登录后体验完整服务', description: '登录后可使用卖号、消息、个人中心等完整服务。', returnTo })) return
    event.preventDefault()
  }
  const disabledEntries = [
    ['我买到的', <ShoppingBag size={22} />],
    ['我卖出的', <Store size={22} />],
    ['我的售后', <ShieldCheck size={22} />],
    ['账号回收', <RefreshCw size={22} />],
  ] as const
  return <main className="profile-v2-page profile-v2-guest" data-node-id="3681:28976">
    <header className="profile-v2-guest-header">
      <StatusBar muted />
      <div className="profile-v2-guest-identity"><span className="profile-v2-avatar guest"><UserRound size={27} strokeWidth={1.8} aria-hidden="true" /></span><span><h1>游客</h1><p>登录后管理你的交易</p></span></div>
      <div className="profile-v2-guest-metrics"><span>—<small>余额</small></span><span>—<small>收藏</small></span><span>—<small>求购</small></span></div>
    </header>
    <div className="profile-v2-scroll profile-v2-guest-scroll">
      <Link className="profile-v2-guest-login" to={buildLoginRoute('one_tap', '/profile', '/profile')}>登录 / 注册</Link>
      <section className="profile-v2-order-hub guest" aria-labelledby="profile-guest-order-title"><h2 id="profile-guest-order-title">我的交易</h2><div>{disabledEntries.map(([label, icon]) => <Link key={label} to={buildLoginRoute('one_tap', '/profile', '/profile')} aria-label={`登录后查看${label}`}><span aria-hidden="true">{icon}</span><b>{label}</b></Link>)}</div></section>
      <Link className="profile-v2-seller-card guest" to={buildLoginRoute('one_tap', '/seller/center', '/profile')}><span className="profile-v2-seller-icon"><Store size={21} /></span><span><strong>成为卖家</strong><small>先了解卖家能力，开始签约时再登录</small></span><b>了解</b></Link>
    </div>
    <MainNav promptLogin={promptLogin} />
  </main>
}

function AuthenticatedProfilePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedState = searchParams.get('sellerState')
  const sellerState: SellerState = requestedState === 'signing' || requestedState === 'review' || requestedState === 'seller' ? requestedState : 'buyer'
  const seller = sellerStates[sellerState]
  const [orders, setOrders] = useState(() => {
    try { orderRepository.expire(); return orderRepository.list() } catch { return [] }
  })
  const [now, setNow] = useState(() => Date.now())
  const [toast, setToast] = useState('')
  const [followOpen, setFollowOpen] = useState(searchParams.get('follow') === '1')
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
      setToast('ID 已复制')
    } catch { setToast('复制失败，请手动复制') } finally { input?.remove() }
  }
  const logout = () => {
    if (!authRepository.logout()) { setToast('退出失败，请重试'); return }
    navigate('/', { replace: true })
  }

  return <main className="profile-v2-page" data-seller-state={sellerState}>
    <header className="profile-v2-header">
      <StatusBar />
      <div className="profile-v2-user-row"><div className="profile-v2-user-main"><span className="profile-v2-avatar"><UserRound size={27} strokeWidth={1.8} aria-hidden="true" /></span><span className="profile-v2-user-copy"><b>{profileUser.name}</b><small><strong>已实名</strong><i>·</i><span title={profileUser.managementId}>ID {profileUser.managementId}</span><button type="button" onClick={copyId} aria-label={`复制管理ID ${profileUser.managementId}`}><Copy size={13} strokeWidth={2} aria-hidden="true" /></button></small></span></div></div>
      <div className="profile-v2-wallet"><Link to="/wallet" aria-label={`余额${formatMoney(walletBalance)}`}><b>{formatMoney(walletBalance)}</b><span>余额（元）</span></Link><i /><Link to="/favorites" aria-label={`收藏${favoriteCount}件`}><b>{favoriteCount}</b><span>收藏</span></Link></div>
    </header>

    <div className="profile-v2-scroll">
      {pending.length > 0 && <section className="profile-v2-pending" aria-labelledby="pending-title"><h2 id="pending-title"><i />待处理 <b>{pending.length}</b> 件</h2>{pending.map((order) => {
        const isPayment = order.status === 'pending'
        const expiresAt = isPayment ? order.expiresAt : order.actionExpiresAt
        return <div key={order.id}><span><b>{isPayment ? '1 笔订单待付款' : '1 笔待确认收货'}</b><time dateTime={`PT${Math.max(0, Math.ceil(((expiresAt ?? now) - now) / 1000))}S`}>剩 {formatCountdown(expiresAt, now)}</time></span><Link className={isPayment ? 'primary' : ''} to={`/orders?role=buyer&status=${order.status}`}>{isPayment ? '去支付' : '去查看'}</Link></div>
      })}</section>}

      <section className="profile-v2-order-hub" aria-labelledby="profile-order-title"><h2 id="profile-order-title">我的交易</h2><div>
        <OrderEntry label="我买到的" route="/orders?role=buyer" count={buyerPendingCount} icon={<ShoppingBag size={22} strokeWidth={1.8} aria-hidden="true" />} />
        <OrderEntry label="我卖出的" route="/orders?role=seller" count={sellerPendingCount} icon={<Store size={22} strokeWidth={1.8} aria-hidden="true" />} />
        <OrderEntry label="我的售后" route="/aftersales" count={0} icon={<ShieldCheck size={22} strokeWidth={1.8} aria-hidden="true" />} />
        <OrderEntry label="账号回收" route="/sell" count={0} icon={<RefreshCw size={22} strokeWidth={1.8} aria-hidden="true" />} />
      </div></section>

      <Link className={`profile-v2-seller-card ${seller.tone}`} to="/seller/center"><span className="profile-v2-seller-icon"><Store size={21} /></span><span><span><strong>{seller.title}</strong><em>{seller.badge}</em></span><small>{seller.description}</small></span><b>{seller.action}</b></Link>

      <button type="button" className="profile-v2-follow-card" onClick={() => setFollowOpen(true)}><span><MessageSquare size={18} /></span><span><strong>关注公众号，交易进度不错过</strong><small>开启微信交易通知</small></span><b>去关注<ChevronRight size={13} /></b></button>


      <section className="profile-v2-more" aria-labelledby="more-title"><h2 id="more-title">账号与设置</h2><div className="profile-v2-feature-list">{profileMoreEntries.filter((entry) => entry.action !== 'logout' && entry.label !== '卖家签约').map((entry) => {
        const content = <><span className="profile-v2-feature-title"><b>{entry.label}</b>{entry.badge && <em>{entry.badge}</em>}</span></>
        return <Link className="profile-v2-feature-row" key={entry.label} to={entry.route!}>{content}{entry.status && <small>{entry.status}</small>}<ChevronRight size={16} aria-hidden="true" /></Link>
      })}</div><div className="profile-v2-feature-list profile-v2-logout-list"><button type="button" className="profile-v2-feature-row" onClick={logout}><b>退出登录</b><LogOut size={16} aria-hidden="true" /></button></div></section>
    </div>

    <MainNav />
    {followOpen && <FollowDialog onClose={() => setFollowOpen(false)} onSaved={() => { setFollowOpen(false); setToast('二维码已保存到相册') }} />}
    {toast && <div className="profile-v2-toast" role="status">{toast}</div>}
  </main>
}

function FollowDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  return <div className="profile-v2-follow-layer" role="dialog" aria-modal="true" aria-labelledby="follow-title"><button className="profile-v2-follow-mask" type="button" aria-label="关闭关注提示" onClick={onClose} /><section><header><span /><h2 id="follow-title">关注「深度玩家」微信服务号</h2><button type="button" aria-label="关闭" onClick={onClose}><X size={20} /></button></header><p>开启微信交易通知，重要进度及时掌握</p><div className="profile-v2-qr" aria-label="公众号二维码占位"><span>⌗</span><small>公众号二维码占位</small></div><small>请截图保存二维码，再打开微信一扫，从相册识别并关注</small><button type="button" onClick={onSaved}>保存二维码到相册</button></section></div>
}

function OrderEntry({ label, route, count, icon }: { label: string; route: string; count: number; icon: ReactNode }) {
  return <Link to={route} aria-label={`${label}${count > 0 ? `，${count}项待处理` : ''}`}><span aria-hidden="true">{icon}</span><b>{label}</b>{count > 0 && <em aria-label={`${count}项待处理`}>{formatEntryBadge(count)}</em>}</Link>
}
