import { useState } from 'react'
import { Copy, Layers3, Store, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { BottomNavView } from '../components/BottomNav'
import { DesignPromptTrigger } from '../components/DesignPromptTrigger'
import { Button, Heading, SurfaceCard, Toast } from '../components/ui'
import { getLinkedProfileSellerState, profileSellerCards } from '../components/profileSellerModel'
import { useRestoredClient } from '../linked/RestoredClientProvider'
import { useRestoredSeller } from '../linked/useRestoredSeller'
import { useRestoredMessages } from '../linked/useRestoredMessages'
import '../styles/profile-v2.css'

/** No account/order/favorites prototype repository is consumed in this mode. */
export function RestoredProfilePage() {
  const { connection, reconnect } = useRestoredClient()
  const { seller, loading, error, refresh } = useRestoredSeller()
  const messages = useRestoredMessages()
  const [toast, setToast] = useState('')
  if (!connection) return null
  const { actor } = connection
  const state = getLinkedProfileSellerState(seller?.status, seller?.contractStatus)
  const card = profileSellerCards[state]
  const blocked = seller?.status === 'DISABLED' || seller?.provenance === 'UNVERIFIED'
    || (seller?.status === 'APPROVED' && seller.contractStatus === 'SIGNED' && !seller.canPublish)
  const copyId = async () => {
    try { await navigator.clipboard.writeText(actor.managementId); setToast('ID 已复制') }
    catch { setToast('复制失败，请手动复制') }
  }
  return <main className="profile-v2-page" data-seller-state={state}>
    <header className="profile-v2-header">
      <DesignPromptTrigger nodeId="3681:37368" className="profile-v2-status" />
      <Link className="profile-v2-library-entry" to="/component-library" aria-label="查看组件库与规范"><Layers3 size={19} aria-hidden="true" /><span>组件库</span></Link>
      <div className="profile-v2-user-row"><div className="profile-v2-user-main"><span className="profile-v2-avatar"><UserRound size={27} strokeWidth={1.8} aria-hidden="true" /></span><span className="profile-v2-user-copy"><b>{actor.displayName}</b><small><span title={actor.managementId}>ID {actor.managementId}</span><button type="button" onClick={() => void copyId()} aria-label={`复制管理ID ${actor.managementId}`}><Copy size={13} aria-hidden="true" /></button></small></span></div></div>
      <div className="profile-v2-wallet"><Link to="/wallet"><b>—</b><span>钱包 · 暂未接入</span></Link><i /><Link to="/favorites"><b>—</b><span>收藏 · 暂未接入</span></Link></div>
    </header>
    <div className="profile-v2-scroll">
      <SurfaceCard><Heading variant="section">本地恢复联动</Heading><p>可写入本地数据；当前主体由服务端绑定，不代表真实手机号登录。</p><small>{connection.runtime.runtimeId}</small></SurfaceCard>
      {error ? <SurfaceCard><p role="alert">{error}{seller ? '（上次状态已过期）' : ''}</p><Button variant="outline" onClick={() => void refresh()}>重试读取卖家状态</Button></SurfaceCard> : loading && !seller ? <p role="status">正在读取卖家状态…</p> : seller && <section className={`profile-v2-seller-card ${card.tone}`}>
        <span className="profile-v2-seller-icon"><Store size={21} aria-hidden="true" /></span>
        <Link className="profile-v2-seller-card-main" to="/seller/center"><span><span><strong>{blocked ? '卖家能力暂不可用' : card.title}</strong></span><small>{blocked ? '当前服务端未开放卖家发布能力，请查看详情。' : seller.reviewReason || (seller.canPublish ? '管理本人商品与审核进度' : card.description)}</small></span><b>{blocked ? '查看详情' : card.action}</b></Link>
      </section>}
      <SurfaceCard><Heading variant="section">商品与订单</Heading><p><Link to="/buy">购买账号</Link></p><p><Link to="/orders">我的买卖订单</Link></p><p><Link to="/my-goods">我的商品</Link></p>{seller?.canPublish && !error && <p><Link to="/publish">发布商品</Link></p>}<p>购买与继续付款仅使用服务端公开商品、报价和本人订单；钱包等仍未接入。</p></SurfaceCard>
      <SurfaceCard><Heading variant="section">回收咨询</Heading><p><Link to="/recycle">填写资料，选择回收商</Link></p><p><Link to="/message?tab=recycle">我的回收会话</Link></p><p>各回收商独立沟通。回收单可在咨询会话内报价、确认与支付（本地演示）。</p></SurfaceCard>
      {messages.error && <SurfaceCard><p role="alert">{messages.error}</p><Button variant="outline" onClick={() => void messages.refresh()}>重试读取消息</Button></SurfaceCard>}
      <Button variant="outline" onClick={reconnect}>重新连接演示身份</Button>
    </div>
    <BottomNavView placement="flow" activeKey="profile" items={[
      { key: 'home', label: '首页', href: '/', icon: 'nav-home.svg' },
      { key: 'catalog', label: '买号', href: '/buy', icon: 'nav-buy.svg' },
      { key: 'sell', label: '卖', href: '/sell' },
      { key: 'message', label: '消息', href: '/message', icon: 'nav-message.svg', badgeCount: messages.error ? 0 : messages.unreadCount },
      { key: 'profile', label: '我的', href: '/profile', icon: 'nav-profile.svg' },
    ]} />
    <Toast message={toast} onDismiss={() => setToast('')} />
  </main>
}
