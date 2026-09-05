import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bell, CheckCircle2, Clock3, Gem, Info, Settings, ShieldCheck, WalletCards, type LucideIcon } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { messageRepository } from '../repository/messageRepository'
import { MessageNav } from './MessagePage'
import '../styles/notifications-draft3.css'

type NoticeKind = 'trade' | 'aftersales' | 'listing' | 'system'
type NoticeItem = {
  id: string
  kind: NoticeKind
  group: '需要处理' | '今天' | '更早'
  title: string
  body: string
  time: string
  tag: string
  unread?: boolean
  action?: string
  href?: string
  Icon: LucideIcon
}

const noticeFilters: Array<{ key: 'all' | NoticeKind; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'trade', label: '交易' },
  { key: 'aftersales', label: '售后' },
  { key: 'listing', label: '上架提醒' },
  { key: 'system', label: '系统' },
]

const notices: NoticeItem[] = [
  { id: 'after-1', kind: 'aftersales', group: '需要处理', title: '待补充材料', body: '王者荣耀 QQ区的售后需要你补充退款协商记录，补充后平台继续核查。', time: '14:32', tag: '售后', unread: true, action: '补充材料', href: '/aftersales', Icon: ShieldCheck },
  { id: 'trade-1', kind: 'trade', group: '需要处理', title: '订单待支付', body: '和平精英 微信区订单将在 18 分钟后自动取消。', time: '13:05', tag: '交易', unread: true, action: '去支付', href: '/orders?type=bought', Icon: Clock3 },
  { id: 'trade-2', kind: 'trade', group: '今天', title: '交易已完成', body: '原神 亚服订单资金已经结算至余额。', time: '11:20', tag: '交易', Icon: CheckCircle2 },
  { id: 'listing-1', kind: 'listing', group: '今天', title: '你关注的皮肤有新号', body: '含「倪克斯神谕」的账号新上架 3 个，¥1,190 起。', time: '10:04', tag: '上架提醒', unread: true, href: '/game?gameCode=wzry', Icon: Gem },
  { id: 'match-1', kind: 'trade', group: '今天', title: '求购有新匹配', body: '客服为你的求购找到 6 个符合条件的账号。', time: '09:12', tag: '交易', unread: true, href: '/game?gameCode=wzry', Icon: Bell },
  { id: 'system-1', kind: 'system', group: '更早', title: '保障规则更新', body: '换绑后自动确认收货时间调整为 72 小时，点击查看详情。', time: '08-30', tag: '系统', Icon: Info },
  { id: 'system-2', kind: 'system', group: '更早', title: '提现已到账', body: '¥1,280 已到账至你的银行卡（尾号 8842）。', time: '08-28', tag: '系统', href: '/wallet', Icon: WalletCards },
]

function NotificationStatusBar() {
  return <div className="notification-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
}

export function NotificationCenterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState<'all' | NoticeKind>('all')
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set(notices.filter((item) => !item.unread).map((item) => item.id)))
  const filtered = useMemo(() => searchParams.get('empty') === '1' ? [] : notices.filter((item) => filter === 'all' || item.kind === filter), [filter, searchParams])
  const unreadCount = notices.filter((item) => !readIds.has(item.id)).length
  const markAllRead = async () => {
    setReadIds(new Set(notices.map((item) => item.id)))
    await messageRepository.markAllRead()
  }
  const openNotice = (item: NoticeItem) => {
    setReadIds((current) => new Set(current).add(item.id))
    if (item.href) navigate(item.href)
  }

  return <main className="notification-page">
    <header className="notification-main-header">
      <NotificationStatusBar />
      <div className="notification-heading"><h1>消息</h1><div><button type="button" onClick={() => void markAllRead()}>全部已读</button><button type="button" onClick={() => navigate('/notifications/settings')} aria-label="通知设置"><Settings size={18} aria-hidden="true" /></button></div></div>
      <nav className="notification-root-tabs" aria-label="消息分类"><button type="button" onClick={() => navigate('/message')}>全部</button><button type="button" onClick={() => navigate('/message?tab=groups')}>交易群</button><button type="button" className="active" aria-current="page">通知</button></nav>
      <div className="notification-filter-row" role="tablist" aria-label="通知类型">{noticeFilters.map((item) => <button type="button" role="tab" key={item.key} className={filter === item.key ? 'active' : ''} aria-selected={filter === item.key} onClick={() => setFilter(item.key)}>{item.label}{item.key !== 'all' && <small>{notices.filter((notice) => notice.kind === item.key).length}</small>}</button>)}</div>
    </header>
    <section className="notification-scroll" aria-live="polite">
      {filtered.length ? (['需要处理', '今天', '更早'] as const).map((group) => {
        const items = filtered.filter((item) => item.group === group)
        return items.length ? <section className="notification-group" key={group}><h2>{group}</h2><div>{items.map((item) => <button type="button" key={item.id} className="notification-card" onClick={() => openNotice(item)}><span className={`notification-card-icon kind-${item.kind}`}><item.Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span><span className="notification-card-copy"><span><small>{item.tag}</small><b>{item.title}{!readIds.has(item.id) && <i aria-label="未读" />}</b><time>{item.time}</time></span><p>{item.body}</p>{item.action && <strong>{item.action}</strong>}</span></button>)}</div></section> : null
      }) : <div className="notification-empty"><span><Bell size={23} strokeWidth={1.7} aria-hidden="true" /></span><h2>{filter === 'listing' ? '暂无上架提醒' : '暂无通知'}</h2><p>{filter === 'listing' ? '收藏账号或关注皮肤后，有新号上架会在这里通知你。' : '新的交易和平台消息会出现在这里。'}</p>{filter === 'listing' && <button type="button" onClick={() => navigate('/game?gameCode=wzry')}>去买号页看看</button>}</div>}
    </section>
    <MessageNav unreadCount={unreadCount} />
  </main>
}

type NotificationSettingKey = 'trade' | 'aftersales' | 'listing' | 'matching' | 'campaign'
const settingDefinitions: Array<{ key: NotificationSettingKey; title: string; detail: string; locked?: boolean }> = [
  { key: 'trade', title: '交易进度', detail: '下单、验号、换绑、完成等节点', locked: true },
  { key: 'aftersales', title: '售后进度', detail: '核查中、待补充材料、处理结果', locked: true },
  { key: 'listing', title: '上架提醒', detail: '收藏账号降价、关注皮肤有新号' },
  { key: 'matching', title: '求购匹配', detail: '客服或系统找到符合条件的账号' },
  { key: 'campaign', title: '平台活动', detail: '优惠、活动与运营推荐' },
]
const SETTINGS_KEY = 'deepgamer.notification-settings.v1'

export function NotificationSettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<Record<NotificationSettingKey, boolean>>(() => {
    const defaults = { trade: true, aftersales: true, listing: true, matching: true, campaign: false }
    try { return { ...defaults, ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? '{}'), trade: true, aftersales: true } }
    catch { return defaults }
  })
  useEffect(() => { try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* storage unavailable */ } }, [settings])
  const toggle = (key: NotificationSettingKey) => setSettings((current) => ({ ...current, [key]: !current[key] }))

  return <main className="notification-page notification-settings-page">
    <NotificationStatusBar />
    <header className="notification-subheader"><button type="button" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft size={21} aria-hidden="true" /></button><h1>通知设置</h1></header>
    <section className="notification-settings-scroll"><h2>接收哪些通知</h2><div className="notification-settings-card">{settingDefinitions.map((item) => <div className="notification-setting-row" key={item.key}><span><b>{item.title}</b><small>{item.detail}</small></span><button type="button" role="switch" aria-checked={settings[item.key]} disabled={item.locked} className={settings[item.key] ? 'active' : ''} onClick={() => toggle(item.key)}><i /></button></div>)}</div><p>交易与售后通知涉及订单进度，无法关闭。系统 Push 权限由手机设置控制。</p></section>
    <MessageNav unreadCount={3} />
  </main>
}
