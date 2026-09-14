import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bell, CheckCircle2, Clock3, Gem, Info, Settings, ShieldCheck, WalletCards, type LucideIcon } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { Button, Heading, IconButton, PageHeader, StatusBar, Tabs, ToggleSwitch } from '../components/ui'
import { messageRepository } from '../repository/messageRepository'
import { BottomNav } from '../components/BottomNav'
import { useMessageState } from '../components/useMessageState'
import type { NotificationItem, NotificationKind } from '../types/message'
import '../styles/notifications-draft3.css'
import { getRuntimeStorage } from '../runtime/dataMode'

type NoticeKind = NotificationKind
const noticeIcons: Record<NotificationItem['icon'], LucideIcon> = { shield: ShieldCheck, clock: Clock3, check: CheckCircle2, gem: Gem, bell: Bell, info: Info, wallet: WalletCards }

const noticeFilters: Array<{ key: 'all' | NoticeKind; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'trade', label: '交易' },
  { key: 'aftersales', label: '售后' },
  { key: 'listing', label: '上架提醒' },
  { key: 'system', label: '系统' },
]

function NotificationStatusBar() { return <StatusBar className="notification-status" /> }

export function NotificationCenterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [filter, setFilter] = useState<'all' | NoticeKind>('all')
  const store = useMessageState()
  const notices = useMemo(() => (store.notifications ?? []).map(item => ({ ...item, Icon: noticeIcons[item.icon] })), [store.notifications])
  const [error, setError] = useState('')
  const filtered = useMemo(() => searchParams.get('empty') === '1' ? [] : notices.filter((item) => filter === 'all' || item.kind === filter), [filter, searchParams, notices])
  const markAllRead = async () => {
    const ok = await messageRepository.markAllRead('notifications')
    setError(ok ? '' : '标记已读失败，请重试')
  }
  const openNotice = async (item: NotificationItem) => {
    if (!await messageRepository.markNotificationRead(item.id)) { setError('标记已读失败，请重试'); return }
    setError('')
    if (item.href) navigate(item.href)
  }

  return <main className="notification-page">
    <header className="notification-main-header">
      <NotificationStatusBar />
      <PageHeader className="notification-page-header" bordered={false} sideSize="wide" title="消息" right={<><Button size="xs" variant="ghost" onClick={() => void markAllRead()}>全部已读</Button><IconButton label="通知设置" onClick={() => navigate('/notifications/settings')}><Settings size={18} aria-hidden="true" /></IconButton></>} />
      <nav className="notification-root-tabs" aria-label="消息分类"><button type="button" className="dg-underline-tab" onClick={() => navigate('/message')}>全部</button><button type="button" className="dg-underline-tab" onClick={() => navigate('/message?tab=groups')}>交易群</button><button type="button" className="dg-underline-tab active" aria-current="page">通知</button></nav>
      <Tabs className="notification-filter-tabs" label="通知类型" panelId="notification-filter-panel" value={filter} onValueChange={(value) => setFilter(value as 'all' | NoticeKind)} items={noticeFilters.map((item) => ({ value: item.key, label: item.label, count: item.key === 'all' ? undefined : notices.filter((notice) => notice.kind === item.key).length }))} />
    </header>
    <section className="notification-scroll" id="notification-filter-panel" role="tabpanel" aria-live="polite">
      {filtered.length ? (['需要处理', '今天', '更早'] as const).map((group) => {
        const items = filtered.filter((item) => item.group === group)
        return items.length ? <section className="notification-group" key={group}><Heading as="h2" variant="group">{group}</Heading><div>{items.map((item) => <button type="button" key={item.id} className="notification-card" onClick={() => void openNotice(item)}><span className={`notification-card-icon kind-${item.kind}`}><item.Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span><span className="notification-card-copy"><span><small>{item.tag}</small><b>{item.title}{item.unread && <i aria-label="未读" />}</b><time>{item.time}</time></span><p>{item.body}</p>{item.action && <strong>{item.action}</strong>}</span></button>)}</div></section> : null
      }) : <div className="notification-empty"><span><Bell size={23} strokeWidth={1.7} aria-hidden="true" /></span><Heading as="h2" variant="result">{filter === 'listing' ? '暂无上架提醒' : '暂无通知'}</Heading><p>{filter === 'listing' ? '收藏账号或关注皮肤后，有新号上架会在这里通知你。' : '新的交易和平台消息会出现在这里。'}</p>{filter === 'listing' && <button type="button" onClick={() => navigate('/game?gameCode=wzry')}>去买号页看看</button>}</div>}
    </section>
    {error && <p role="alert">{error}</p>}
    <BottomNav placement="flow" showGuestPrompt={false} />
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
    try { return { ...defaults, ...JSON.parse(getRuntimeStorage().getItem(SETTINGS_KEY) ?? '{}'), trade: true, aftersales: true } }
    catch { return defaults }
  })
  useEffect(() => { try { getRuntimeStorage().setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* storage unavailable */ } }, [settings])
  const toggle = (key: NotificationSettingKey) => setSettings((current) => ({ ...current, [key]: !current[key] }))

  return <main className="notification-page notification-settings-page">
    <NotificationStatusBar />
    <PageHeader className="notification-settings-header" title="通知设置" left={<IconButton label="返回" onClick={() => navigate(-1)}><ArrowLeft size={21} aria-hidden="true" /></IconButton>} />
    <section className="notification-settings-scroll"><Heading as="h2" variant="group">接收哪些通知</Heading><div className="notification-settings-card">{settingDefinitions.map((item) => <div className="notification-setting-row" key={item.key}><span><b>{item.title}</b><small>{item.detail}</small></span><ToggleSwitch checked={settings[item.key]} disabled={item.locked} label={`${item.title}${item.locked ? '（始终开启）' : ''}`} onCheckedChange={() => toggle(item.key)} /></div>)}</div><p>交易与售后通知涉及订单进度，无法关闭。系统 Push 权限由手机设置控制。</p></section>
    <BottomNav placement="flow" showGuestPrompt={false} />
  </main>
}
