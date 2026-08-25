import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Gamepad2, Home, MessageCircle, Search, UserRound, X } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { filterConversations, getMessageSummary, groupTradeConversations } from '../components/messageModel'
import { messageRepository } from '../repository/messageRepository'
import type { Conversation, MessageCategory, MessageSummary } from '../types/message'
import { assetPath } from '../components/assetPath'
import '../styles/messages-v2.css'

const tabs: Array<{ key: MessageCategory; label: string }> = [{ key: 'all', label: '全部' }, { key: 'groups', label: '交易群' }, { key: 'notifications', label: '通知' }]

export function MessagePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [summary, setSummary] = useState<MessageSummary>({ unreadCount: 0, groupCount: 0, taskCount: 0 })
  const requestedCategory = searchParams.get('tab')
  const [category, setCategory] = useState<MessageCategory>(requestedCategory === 'groups' || requestedCategory === 'notifications' ? requestedCategory : 'all')
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const next = await messageRepository.list()
      setConversations(next); setSummary(getMessageSummary({ conversations: next, messages: [] })); setError('')
    } catch { setError('加载消息失败') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(); return messageRepository.subscribe(() => { void load() }) }, [load])
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 1800); return () => window.clearTimeout(timer) }, [toast])
  useEffect(() => { if (searchOpen) requestAnimationFrame(() => searchRef.current?.focus()) }, [searchOpen])

  const filtered = useMemo(() => filterConversations(conversations, category, query), [category, conversations, query])
  const groups = useMemo(() => groupTradeConversations(filtered), [filtered])
  const openConversation = async (conversation: Conversation) => {
    await messageRepository.markRead(conversation.id)
    if (conversation.kind !== 'notification') navigate(`/im/${conversation.id}`)
  }
  const markAll = async () => setToast(await messageRepository.markAllRead() ? '已全部标为已读' : '操作失败，请重试')
  const selectCategory = (next: MessageCategory) => {
    setCategory(next)
    setSearchParams(next === 'all' ? {} : { tab: next }, { replace: true })
  }

  return <main className="message-v2-page">
    <header className="message-v2-header">
      <div className="message-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
      <div className="message-v2-title"><h1>消息</h1>{searchOpen ? <form role="search" onSubmit={(event) => event.preventDefault()}><Search size={16} aria-hidden="true" /><input ref={searchRef} value={query} maxLength={40} onChange={(event) => setQuery(event.target.value)} placeholder="订单号 / 商品编号" aria-label="订单编号或商品编号" /><button type="button" onClick={() => { setQuery(''); setSearchOpen(false) }} aria-label="关闭搜索"><X size={16} /></button></form> : <button type="button" onClick={() => setSearchOpen(true)} aria-label="搜索消息"><Search size={18} aria-hidden="true" /></button>}</div>
      <nav className="message-v2-tabs" role="tablist" aria-label="消息分类">{tabs.map((tab) => <button type="button" role="tab" key={tab.key} className={category === tab.key ? 'active' : ''} aria-selected={category === tab.key} onClick={() => selectCategory(tab.key)}>{tab.label}{tab.key === 'notifications' && conversations.some((item) => item.kind === 'notification' && item.unreadCount > 0) && <i aria-label="有未读通知" />}</button>)}</nav>
    </header>

    <section className="message-v2-scroll" role="tabpanel" aria-label="会话列表">
      {loading ? <MessageState label="正在加载消息" loading /> : error ? <MessageState label={error} action="重试" onAction={() => void load()} /> : <>
        {category === 'all' && !query && summary.taskCount > 0 && <button className="message-task-card" type="button" onClick={() => selectCategory('groups')}><span><b><em>{summary.taskCount}</em> 个交易需要你处理</b><small>待付款 1 · 待确认收货 1</small></span><strong>查看</strong></button>}
        {category === 'groups' ? <GroupSections groups={groups} onOpen={openConversation} /> : filtered.length ? <>
          {category === 'all' && filtered.some((item) => item.kind === 'trade_group') && <SectionTitle>交易群</SectionTitle>}
          <div className="message-conversation-list">{filtered.filter((item) => category !== 'all' || item.kind === 'trade_group').map((item) => <ConversationRow item={item} key={item.id} onOpen={openConversation} />)}</div>
          {category === 'all' && filtered.some((item) => item.kind !== 'trade_group') && <><SectionTitle>官方客服</SectionTitle><div className="message-conversation-list">{filtered.filter((item) => item.kind !== 'trade_group').map((item) => <ConversationRow item={item} key={item.id} onOpen={openConversation} />)}</div></>}
          {category === 'notifications' && summary.unreadCount > 0 && <button type="button" className="message-mark-all" onClick={() => void markAll()}>全部已读</button>}
        </> : <MessageState label={query ? '没有匹配的订单或商品消息' : '暂无消息'} />}
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
  return <button type="button" className={`message-conversation stage-${item.stage}`} onClick={() => onOpen(item)} aria-label={`${item.title}${item.progressLabel ? `，${item.progressLabel}` : ''}，${item.lastMessage}，${timeLabel}${item.unreadCount ? `，${item.unreadCount}条未读` : ''}`}><span className={`message-avatar game-${item.gameCode ?? item.kind}`}>{item.avatarText}</span><span className="message-row-copy"><span><b>{item.title}</b><time>{timeLabel}</time></span>{item.progressLabel && <strong>{item.progressLabel}</strong>}<small>{item.lastMessage}</small></span>{item.unreadCount > 0 && <i>{item.unreadCount}</i>}</button>
}
function MessageState({ label, action, onAction, loading }: { label: string; action?: string; onAction?: () => void; loading?: boolean }) { return <div className="message-v2-state" role={action ? 'alert' : 'status'}>{loading && <i />}<p>{label}</p>{action && <button type="button" onClick={onAction}>{action}</button>}</div> }
function MessageNav({ unreadCount }: { unreadCount: number }) {
  const items = [{ label: '首页', href: '/', Icon: Home }, { label: '买号', href: '/game?gameCode=wzry', Icon: Gamepad2 }, { label: '卖', href: '/sell', featured: true }, { label: '消息', href: '/message', Icon: MessageCircle }, { label: '我的', href: '/profile', Icon: UserRound }]
  return <nav className="message-v2-nav" aria-label="主导航">{items.map(({ label, href, Icon, featured }) => <Link key={label} to={href} className={`${href === '/message' ? 'active' : ''} ${featured ? 'featured' : ''}`} aria-current={href === '/message' ? 'page' : undefined}>{featured ? <b>卖</b> : <><span>{Icon && <Icon size={22} strokeWidth={1.8} aria-hidden="true" />}{href === '/message' && unreadCount > 0 && <i>{Math.min(99, unreadCount)}</i>}</span><small>{label}</small></>}</Link>)}</nav>
}
