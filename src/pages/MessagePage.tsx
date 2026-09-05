import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Gamepad2, Headphones, Home, MessageCircle, Search, UserRound, X } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { filterConversations, getMessageSummary, groupTradeConversations } from '../components/messageModel'
import { messageRepository } from '../repository/messageRepository'
import type { Conversation, MessageSummary } from '../types/message'
import { assetPath } from '../components/assetPath'
import '../styles/messages-v2.css'

type MessageTab = 'all' | 'groups' | 'recycle'
const tabs: Array<{ key: MessageTab | 'notifications'; label: string }> = [{ key: 'all', label: '全部' }, { key: 'groups', label: '交易群' }, { key: 'recycle', label: '回收咨询' }, { key: 'notifications', label: '通知' }]

export function MessagePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [summary, setSummary] = useState<MessageSummary>({ unreadCount: 0, groupCount: 0, taskCount: 0 })
  const requestedCategory = searchParams.get('tab')
  const [category, setCategory] = useState<MessageTab>(requestedCategory === 'groups' || requestedCategory === 'recycle' ? requestedCategory : 'all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    try {
      const next = await messageRepository.list()
      setConversations(next); setSummary(getMessageSummary({ conversations: next, messages: [] })); setError('')
    } catch { setError('加载消息失败') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(); return messageRepository.subscribe(() => { void load() }) }, [load])
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 1800); return () => window.clearTimeout(timer) }, [toast])

  const filtered = useMemo(() => {
    const source = filterConversations(conversations, category === 'groups' ? 'groups' : 'all', query)
    if (category === 'recycle') return source.filter((item) => item.kind === 'support')
    if (category === 'all' && !query) {
      const priority = { support: 0, notification: 1, trade_group: 2 } as const
      return [...source].sort((a, b) => priority[a.kind] - priority[b.kind] || b.updatedAt - a.updatedAt)
    }
    return source
  }, [category, conversations, query])
  const groups = useMemo(() => groupTradeConversations(filtered), [filtered])
  const openConversation = async (conversation: Conversation) => {
    await messageRepository.markRead(conversation.id)
    navigate(conversation.kind === 'notification' ? '/notifications' : `/im/${conversation.id}`)
  }
  const selectCategory = (next: MessageTab | 'notifications') => {
    if (next === 'notifications') { navigate('/notifications'); return }
    setCategory(next)
    setSearchParams(next === 'all' ? {} : { tab: next }, { replace: true })
  }

  return <main className="message-v2-page">
    <header className="message-v2-header">
      <div className="message-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
      <div className="message-v2-title"><h1>消息</h1><form role="search" onSubmit={(event) => event.preventDefault()}><Search size={16} aria-hidden="true" /><input value={query} maxLength={40} onChange={(event) => setQuery(event.target.value)} placeholder="订单号 / 商品编号" aria-label="订单编号或商品编号" />{query && <button type="button" onClick={() => setQuery('')} aria-label="清空搜索"><X size={16} /></button>}</form></div>
      <nav className="message-v2-tabs" role="tablist" aria-label="消息分类">{tabs.map((tab) => <button type="button" role="tab" key={tab.key} className={category === tab.key ? 'active' : ''} aria-selected={category === tab.key} onClick={() => selectCategory(tab.key)}>{tab.label}{tab.key === 'notifications' && conversations.some((item) => item.kind === 'notification' && item.unreadCount > 0) && <i aria-label="有未读通知" />}</button>)}</nav>
    </header>

    <section className="message-v2-scroll" role="tabpanel" aria-label="会话列表">
      {loading ? <MessageState label="正在加载消息" loading /> : error ? <MessageState label={error} action="重试" onAction={() => void load()} /> : <>
        {category === 'groups' ? <GroupSections groups={groups} onOpen={openConversation} /> : filtered.length ? <div className="message-conversation-list message-conversation-flat">{filtered.map((item) => <ConversationRow item={item} key={item.id} onOpen={openConversation} />)}</div> : <MessageState label={query ? '没有匹配的订单或商品消息' : category === 'recycle' ? '暂无回收咨询' : '暂无消息'} />}
      </>}
    </section>
    <MessageNav unreadCount={summary.unreadCount} />
    {toast && <div className="message-v2-toast" role="status">{toast}</div>}
  </main>
}

function SectionTitle({ children }: { children: string }) { return <h2 className="message-section-title">{children}</h2> }
function GroupSections({ groups, onOpen }: { groups: ReturnType<typeof groupTradeConversations>; onOpen: (item: Conversation) => void }) {
  const config = [{ key: 'need_action', label: '需要我处理' }, { key: 'in_progress', label: '进行中' }, { key: 'closed', label: '已完成/已关闭' }] as const
  const count = config.reduce((sum, item) => sum + groups[item.key].length, 0)
  if (!count) return <MessageState label="暂无交易群" />
  return <>{config.map(({ key, label }) => groups[key].length > 0 && <section key={key}><h2 className="message-section-title">{label} <small>{groups[key].length}</small></h2><div className="message-conversation-list">{groups[key].map((item) => <ConversationRow item={item} key={item.id} onOpen={onOpen} />)}</div></section>)}</>
}
function ConversationRow({ item, onOpen }: { item: Conversation; onOpen: (item: Conversation) => void }) {
  const timeLabel = item.elapsedLabel ?? new Date(item.updatedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  const gameIcon = item.gameCode === 'sjzxd' ? 'delta' : item.gameCode === 'ys' ? 'genshin' : item.gameCode
  return <button type="button" className={`message-conversation stage-${item.stage}`} onClick={() => onOpen(item)} aria-label={`${item.title}${item.progressLabel ? `，${item.progressLabel}` : ''}，${item.lastMessage}，${timeLabel}${item.unreadCount ? `，${item.unreadCount}条未读` : ''}`}><span className={`message-avatar game-${item.gameCode ?? item.kind}`}>{item.gameCode ? <img src={assetPath(`assets/games/${gameIcon}.png`)} alt="" /> : item.kind === 'support' ? <Headphones size={22} aria-hidden="true" /> : <Bell size={21} aria-hidden="true" />}</span><span className="message-row-copy"><span><b>{item.title}{item.kind === 'support' && <em>平台客服</em>}</b><time>{timeLabel}</time></span>{item.progressLabel && <strong>{item.progressLabel}</strong>}<small>{item.lastMessage}</small></span>{item.unreadCount > 0 && <i>{item.unreadCount}</i>}</button>
}
function MessageState({ label, action, onAction, loading }: { label: string; action?: string; onAction?: () => void; loading?: boolean }) { return <div className="message-v2-state" role={action ? 'alert' : 'status'}>{loading && <i />}<p>{label}</p>{action && <button type="button" onClick={onAction}>{action}</button>}</div> }
export function MessageNav({ unreadCount }: { unreadCount: number }) {
  const items = [{ label: '首页', href: '/', Icon: Home }, { label: '买号', href: '/game?gameCode=wzry', Icon: Gamepad2 }, { label: '卖', href: '/sell', featured: true }, { label: '消息', href: '/message', Icon: MessageCircle }, { label: '我的', href: '/profile', Icon: UserRound }]
  return <nav className="message-v2-nav" aria-label="主导航">{items.map(({ label, href, Icon, featured }) => <Link key={label} to={href} className={`${href === '/message' ? 'active' : ''} ${featured ? 'featured' : ''}`} aria-current={href === '/message' ? 'page' : undefined}>{featured ? <b>卖</b> : <><span>{Icon && <Icon size={22} strokeWidth={1.8} aria-hidden="true" />}{href === '/message' && unreadCount > 0 && <i>{Math.min(99, unreadCount)}</i>}</span><small>{label}</small></>}</Link>)}</nav>
}
