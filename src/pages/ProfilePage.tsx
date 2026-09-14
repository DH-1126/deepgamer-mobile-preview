import { useEffect, useState, type ReactNode } from 'react'
import {
  Copy,
  Layers3,
  MessageSquare,
  QrCode,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Store,
  UserRound,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuthStatus } from '../components/AuthAccess'
import { BottomNav } from '../components/BottomNav'
import { ProfileFeatureList } from '../components/ProfileFeatureList'
import { useAccountSettings } from '../components/useAccountSettings'
import { buildLoginRoute } from '../components/authModel'
import { assetPath } from '../components/assetPath'
import { getLinkedProfileSellerState, getProfileSellerRoute, nextProfileSellerState, parseProfileSellerState, profileSellerCards, type ProfileSellerState } from '../components/profileSellerModel'
import { BottomSheet, Button, Cell, CountBadge, Heading, StatusBar, Toast } from '../components/ui'
import { usePendingOrderSummary } from '../components/usePendingOrderSummary'
import { formatCountdown, formatMoney } from '../components/profileModel'
import { profileMoreEntries, profileUser } from '../data/profileFixtures'
import { favoriteRepository } from '../repository/favoriteRepository'
import { orderRepository } from '../repository/orderRepository'
import { useLinkedState } from '../linked/linkedData'
import { isLinkedDataMode } from '../runtime/dataMode'
import '../styles/profile-v2.css'

export function ProfilePage() {
  const authenticated = useAuthStatus()
  const [searchParams] = useSearchParams()
  return authenticated && searchParams.get('scenario') !== 'guest' ? <AuthenticatedProfilePage /> : <GuestProfilePage />
}

function ComponentLibraryEntry() {
  return <Link className="profile-v2-library-entry" to="/component-library" aria-label="查看组件库与规范"><Layers3 size={19} aria-hidden="true" /><span>组件库</span></Link>
}

function GuestProfilePage() {
  const disabledEntries = [
    ['我买到的', <ShoppingBag size={22} />],
    ['我卖出的', <Store size={22} />],
    ['我的售后', <ShieldCheck size={22} />],
    ['账号回收', <RefreshCw size={22} />],
  ] as const
  return <main className="profile-v2-page profile-v2-guest" data-node-id="3681:28976">
    <header className="profile-v2-guest-header">
      <StatusBar className="profile-v2-status muted" />
      <ComponentLibraryEntry />
      <div className="profile-v2-guest-identity"><span className="profile-v2-avatar guest"><UserRound size={27} strokeWidth={1.8} aria-hidden="true" /></span><span><Heading variant="page">游客</Heading><p>登录后管理你的交易</p></span></div>
      <div className="profile-v2-guest-metrics"><span>—<small>钱包</small></span><span>—<small>收藏</small></span><span>—<small>求购</small></span></div>
    </header>
    <div className="profile-v2-scroll profile-v2-guest-scroll">
      <Link className="profile-v2-guest-login" to={buildLoginRoute('one_tap', '/profile', '/profile')}>登录 / 注册</Link>
      <section className="profile-v2-order-hub guest" aria-labelledby="profile-guest-order-title"><Heading id="profile-guest-order-title" variant="section">我的交易</Heading><div>{disabledEntries.map(([label, icon]) => <Link key={label} to={buildLoginRoute('one_tap', '/profile', '/profile')} aria-label={`登录后查看${label}`}><span aria-hidden="true">{icon}</span><b>{label}</b></Link>)}</div></section>
      <Link className="profile-v2-seller-card guest" to={buildLoginRoute('one_tap', '/seller/center', '/profile')}><span className="profile-v2-seller-icon"><Store size={21} /></span><span><strong>成为卖家</strong><small>先了解卖家能力，开始签约时再登录</small></span><b>了解</b></Link>
    </div>
    <BottomNav placement="flow" showGuestPrompt={false} />
  </main>
}

function AuthenticatedProfilePage() {
  const account = useAccountSettings()
  const linkedState = useLinkedState()
  const [searchParams, setSearchParams] = useSearchParams()
  const prototypeSellerState = parseProfileSellerState(searchParams.get('sellerState') ?? searchParams.get('scenario'))
  const sellerState: ProfileSellerState = isLinkedDataMode
    ? getLinkedProfileSellerState(linkedState?.seller.status, linkedState?.seller.contractStatus)
    : prototypeSellerState
  const linkedGoodsCount = linkedState?.goods.filter((goods) => goods.sellerId === linkedState.seller.id).length ?? 0
  const seller = isLinkedDataMode && sellerState === 'rejected'
    ? { ...profileSellerCards.rejected, description: linkedState?.seller.reviewReason || profileSellerCards.rejected.description }
    : isLinkedDataMode && sellerState === 'seller' ? { ...profileSellerCards.seller, description: `${linkedGoodsCount} 个联动演示商品` } : profileSellerCards[sellerState]
  const sellerRoute = getProfileSellerRoute(sellerState, isLinkedDataMode)
  const { buyerPendingCount, sellerPendingCount, afterSalePendingCount } = usePendingOrderSummary()
  const [orders, setOrders] = useState(() => {
    try { orderRepository.expire(); return orderRepository.list() } catch { return [] }
  })
  const [now, setNow] = useState(() => Date.now())
  const [toast, setToast] = useState('')
  const [followOpen, setFollowOpen] = useState(searchParams.get('scenario') === 'official-account')
  const [favoriteCount, setFavoriteCount] = useState(() => {
    try { return favoriteRepository.list().length } catch { return profileUser.favoriteCount }
  })
  const pending = orders.filter((order) => order.role === 'buyer' && (order.status === 'pending' || order.status === 'bind_success'))

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
  useEffect(() => {
    const syncFavorites = () => { try { setFavoriteCount(favoriteRepository.list().length) } catch { /* Preserve the last known count. */ } }
    syncFavorites()
    return favoriteRepository.subscribe(syncFavorites)
  }, [])

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
  const cycleSellerPreview = () => {
    if (isLinkedDataMode) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('sellerState', nextProfileSellerState(sellerState))
    setSearchParams(nextParams, { replace: true })
  }
  return <main className="profile-v2-page" data-seller-state={sellerState} data-node-id="3681:37368">
    <header className="profile-v2-header">
      <StatusBar className="profile-v2-status" />
      <ComponentLibraryEntry />
      <div className="profile-v2-user-row"><div className="profile-v2-user-main"><span className="profile-v2-avatar">{account.avatarDataUrl ? <img src={account.avatarDataUrl} alt="个人头像" /> : <UserRound size={27} strokeWidth={1.8} aria-hidden="true" />}</span><span className="profile-v2-user-copy"><b>{account.nickname || profileUser.name}</b><small><span title={profileUser.managementId}>ID {profileUser.managementId}</span><button type="button" onClick={copyId} aria-label={`复制管理ID ${profileUser.managementId}`}><Copy size={13} strokeWidth={2} aria-hidden="true" /></button></small></span></div></div>
      <div className="profile-v2-wallet"><Link to="/wallet" aria-label={`钱包${formatMoney(profileUser.balanceCents)}`}><b>{formatMoney(profileUser.balanceCents)}</b><span>钱包</span></Link><i /><Link to="/favorites" aria-label={`收藏${favoriteCount}件`}><b>{favoriteCount}</b><span>收藏</span></Link></div>
    </header>

    <div className="profile-v2-scroll">
      {searchParams.get('scenario') === 'console' && pending.length > 0 && <section className="profile-v2-pending" aria-labelledby="pending-title" data-node-id="3681:31635"><Heading id="pending-title" variant="section"><i />待处理 <b>{pending.length}</b> 件</Heading>{pending.map((order) => {
        const isPayment = order.status === 'pending'
        const expiresAt = isPayment ? order.expiresAt : order.actionExpiresAt
        return <div key={order.id}><span><b>{isPayment ? '1 笔订单待付款' : '1 笔待确认收货'}</b><time dateTime={`PT${Math.max(0, Math.ceil(((expiresAt ?? now) - now) / 1000))}S`}>剩 {formatCountdown(expiresAt, now)}</time></span><Link className={isPayment ? 'primary' : ''} to={`/orders?role=buyer&status=${order.status}`}>{isPayment ? '去支付' : '去查看'}</Link></div>
      })}</section>}

      <section className="profile-v2-order-hub" aria-labelledby="profile-order-title"><Heading id="profile-order-title" variant="section">我的订单</Heading><div>
        <OrderEntry label="我买到的" route="/orders?role=buyer" count={buyerPendingCount} icon={<ShoppingBag size={22} strokeWidth={1.8} aria-hidden="true" />} />
        <OrderEntry label="我卖出的" route="/orders?role=seller" count={sellerPendingCount} icon={<Store size={22} strokeWidth={1.8} aria-hidden="true" />} />
        <OrderEntry label="我的售后" route="/aftersales" count={afterSalePendingCount} icon={<ShieldCheck size={22} strokeWidth={1.8} aria-hidden="true" />} />
        <OrderEntry label="账号回收" route="/sell" count={0} icon={<RefreshCw size={22} strokeWidth={1.8} aria-hidden="true" />} />
      </div></section>

      <button type="button" className="profile-v2-follow-card" onClick={() => setFollowOpen(true)}><span><MessageSquare size={20} aria-hidden="true" /></span><span><strong>关注公众号，交易进度不错过</strong><small>开启微信交易通知</small></span><b>去关注</b></button>

      <section className={`profile-v2-seller-card ${seller.tone}`} data-node-id={sellerState === 'buyer' ? '3681:31035' : sellerState === 'signing' ? '3681:31225' : sellerState === 'review' ? '3681:31361' : undefined}>
        <button className="profile-v2-seller-icon" type="button" onClick={cycleSellerPreview} disabled={isLinkedDataMode} aria-label={isLinkedDataMode ? `卖家状态：${seller.badge}，由真实签约状态控制` : `切换卖家状态预览，当前${seller.badge}`} title={isLinkedDataMode ? '联动模式下由真实签约状态控制' : '切换卖家状态预览'}><Store size={21} aria-hidden="true" /></button>
        <Link className="profile-v2-seller-card-main" to={sellerRoute}><span><span><strong>{seller.title}</strong><em>{seller.badge}</em></span><small>{seller.description}</small></span><b>{seller.action}</b></Link>
      </section>

      <section className="profile-v2-more" aria-labelledby="more-title"><Heading id="more-title" variant="section">账号与设置</Heading><ProfileFeatureList>{profileMoreEntries.filter((entry) => entry.action !== 'logout' && entry.label !== '卖家签约').map((entry) => {
        const content = <><span className="profile-v2-feature-title"><b>{entry.label}</b>{entry.badge && <em>{entry.badge}</em>}</span></>
        return <Cell key={entry.label} to={entry.route!} label={content} value={entry.status} />
      })}</ProfileFeatureList></section>
    </div>

    <BottomNav placement="flow" showGuestPrompt={false} />
    <BottomSheet open={followOpen} onClose={() => setFollowOpen(false)} title="关注「深度玩家」微信服务号" subtitle="开启微信交易通知，重要进度及时掌握" actions={<Button fullWidth shape="pill" onClick={() => setToast('当前为二维码占位，暂不可保存')}>保存二维码到相册</Button>}><div className="profile-v2-follow-content" data-node-id="3681:37558"><div className="profile-v2-qr"><QrCode size={104} strokeWidth={1.2} aria-hidden="true" /><small>深度玩家服务号</small></div><p>请截图保存二维码，再打开微信扫一扫，<br />从相册识别并关注</p></div></BottomSheet>
    <Toast message={toast} onDismiss={() => setToast('')} />
  </main>
}

function OrderEntry({ label, route, count, icon }: { label: string; route: string; count: number; icon: ReactNode }) {
  return <Link to={route} aria-label={`${label}${count > 0 ? `，${count}项待处理` : ''}`}><span aria-hidden="true">{icon}</span><b>{label}</b><CountBadge count={count} className="profile-v2-order-count" /></Link>
}
