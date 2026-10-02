import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, RefreshCw, Send } from 'lucide-react'
import { BottomNavView, type BottomNavItem } from '../components/BottomNav'
import { Button, Heading, IconButton, PageHeader, SearchField, Spinner, StatusBadge, Tabs, TextAreaField } from '../components/ui'
import type { RestoredImConversation, RestoredImMessage, RestoredImSenderRole } from '../linked/restoredImApi'
import { useRestoredConversation, useRestoredMessages, type RestoredConversationSendState } from '../linked/useRestoredMessages'
import { RestoredRecycleOrderPanel } from './RestoredRecycleOrderPanel'
import '../styles/restored-messages.css'

export type RestoredMessageTab = 'all' | 'trade' | 'recycle'
export function restoredMessageTabFromSearch(search: string): RestoredMessageTab {
  const tab = new URLSearchParams(search).get('tab')
  return tab === 'trade' || tab === 'recycle' ? tab : 'all'
}
export type RestoredMessageScrollAction = 'latest' | 'preserve' | 'defer' | 'none'

export function restoredMessageScrollAction(input: { hadMessages: boolean; latestChanged: boolean; nearBottom: boolean; prepending: boolean; loadingEarlier?: boolean; sentCompleted: boolean }): RestoredMessageScrollAction {
  if (input.prepending && input.loadingEarlier) return 'defer'
  if (input.prepending) return 'preserve'
  if (!input.hadMessages || input.sentCompleted || (input.latestChanged && input.nearBottom)) return 'latest'
  return 'none'
}

export function shouldSubmitRestoredMessageKey(input: { key: string; shiftKey: boolean; isComposing: boolean }) {
  return input.key === 'Enter' && !input.shiftKey && !input.isComposing
}

export function canSubmitRestoredMessage(input: { draft: string; sending: boolean; composerDisabled: boolean; sendState: RestoredConversationSendState }) {
  return Boolean(input.draft.trim()) && !input.sending && !input.composerDisabled && input.sendState !== 'unknown'
}

const tabs = [
  { value: 'all', label: '全部' },
  { value: 'trade', label: '交易' },
  { value: 'recycle', label: '回收' },
]

const roleLabels: Record<RestoredImSenderRole, string> = {
  BUYER: '买家', SELLER: '卖家', SERVICE: '平台客服', AI: '智能客服', SYSTEM: '系统',
}

const disabledReasonLabels: Record<NonNullable<RestoredImConversation['sendDisabledReason']>, string> = {
  CONVERSATION_CLOSED: '会话已关闭',
  FULFILLMENT_TERMINAL: '履约已结束，不能继续发送',
  FULFILLMENT_NOT_RUNNING: '履约未处于进行中，暂不能发送',
  BUSINESS_RELATION_INCOMPLETE: '业务关系不完整，暂不能发送',
}

function formatTime(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
}

function conversationKind(item: RestoredImConversation) {
  return item.type === 'RECYCLE_CONSULTATION' ? '回收' : item.type === 'PRIVATE_CHAT' ? '私聊' : '交易'
}

function associationSummary(item: RestoredImConversation) {
  return item.association.kind === 'TRADE'
    ? `订单 ${item.association.orderNo} · ${item.association.fulfillment.status}`
    : `咨询 ${item.association.consultationId}${item.association.recycleOrderId ? ` · 回收单 ${item.association.recycleOrderId}` : ''}${item.association.recycleOrderStatus ? ` · ${item.association.recycleOrderStatus}` : ''}`
}

export function senderLabel(item: RestoredImMessage) {
  const role = roleLabels[item.senderRole]
  if (item.isMine && (item.senderRole === 'BUYER' || item.senderRole === 'SELLER')) return `我 · ${role}`
  return item.senderName === role ? `${item.senderName} · ${role}` : `${item.senderName || role} · ${role}`
}

function unsupportedLabel(item: RestoredImMessage) {
  if (item.unsupportedReason === 'MEDIA_NOT_AVAILABLE') return '附件内容暂不支持查看'
  if (item.unsupportedReason === 'CARD_CONTENT_NOT_AVAILABLE') return '卡片内容暂不支持查看'
  return item.type === 'IMAGE' ? '附件内容不可用' : item.type === 'CARD' ? '卡片内容不可用' : ''
}

export function RestoredMessageListView({ conversations, loading, error, query, tab, unreadCount, onQueryChange, onTabChange, onRefresh }: {
  conversations: RestoredImConversation[]
  loading: boolean
  error: string | null
  query: string
  tab: RestoredMessageTab
  unreadCount?: number
  onQueryChange: (value: string) => void
  onTabChange: (value: RestoredMessageTab) => void
  onRefresh: () => void
}) {
  const normalized = query.trim().toLocaleLowerCase('zh-CN')
  const filtered = conversations.filter(item => {
    if (tab === 'trade' && item.type === 'RECYCLE_CONSULTATION') return false
    if (tab === 'recycle' && item.type !== 'RECYCLE_CONSULTATION') return false
    return !normalized || `${item.title} ${associationSummary(item)} ${item.lastMessage?.summary ?? ''}`.toLocaleLowerCase('zh-CN').includes(normalized)
  })
  const navItems: BottomNavItem[] = [
    { key: 'home', label: '首页', href: '/', icon: 'nav-home.svg' },
    { key: 'catalog', label: '买号', href: '/game?gameCode=wzry', icon: 'nav-buy.svg' },
    { key: 'sell', label: '卖', href: '/sell' },
    { key: 'message', label: '消息', href: '/message', icon: 'nav-message.svg', badgeCount: unreadCount },
    { key: 'profile', label: '我的', href: '/profile', icon: 'nav-profile.svg' },
  ]
  return <main className="restored-message-page">
    <header className="restored-message-list-header">
      <PageHeader bordered={false} title="消息" right={<IconButton label="刷新会话" disabled={loading} onClick={onRefresh}><RefreshCw size={18} aria-hidden="true" /></IconButton>} />
      <SearchField value={query} onChange={event => onQueryChange(event.target.value)} onClear={() => onQueryChange('')} placeholder="搜索会话、订单或回收单" aria-label="搜索消息" />
      <Tabs items={tabs} value={tab} onValueChange={value => onTabChange(value as RestoredMessageTab)} label="消息分类" variant="underline" />
    </header>
    <section className="restored-message-list-body" aria-busy={loading}>
      {error && conversations.length > 0 && <div className="restored-message-stale" role="status"><b>数据可能已过期</b><span>{error}</span><Button size="xs" variant="outline" onClick={onRefresh}>重试</Button></div>}
      {loading && conversations.length === 0 ? <div className="restored-message-state" role="status"><Spinner />正在加载会话…</div>
        : error && conversations.length === 0 ? <div className="restored-message-state" role="alert"><MessageCircle aria-hidden="true" /><p>{error}</p><Button onClick={onRefresh}>重新加载</Button></div>
          : filtered.length === 0 ? <div className="restored-message-state"><MessageCircle aria-hidden="true" /><Heading as="h2" variant="section">{conversations.length ? '没有匹配的会话' : '暂无会话'}</Heading><p>{conversations.length ? '试试更换搜索词或分类。' : '交易或回收咨询建立后会显示在这里。'}</p></div>
            : <ul className="restored-message-conversations" aria-label="会话列表">{filtered.map(item => <li key={item.id}>
              <Link to={`/im/${encodeURIComponent(item.id)}`} aria-label={`${item.title}，${conversationKind(item)}，${item.unreadCount}条未读`}>
                <span className={`restored-message-avatar ${item.type === 'RECYCLE_CONSULTATION' ? 'recycle' : ''}`} aria-hidden="true">{item.title.trim().slice(0, 1) || '讯'}</span>
                <span className="restored-message-row-copy"><span><b>{item.title || '未命名会话'}</b><StatusBadge tone={item.status === 'CLOSED' ? 'neutral' : item.type === 'RECYCLE_CONSULTATION' ? 'success' : 'brand'}>{item.status === 'CLOSED' ? '已关闭' : conversationKind(item)}</StatusBadge></span><small>{item.lastMessage?.summary || '暂无消息'}</small><em>{associationSummary(item)}</em></span>
                <span className="restored-message-row-meta">{item.unreadCount > 0 && <i aria-label={`${item.unreadCount}条未读`}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</i>}<time dateTime={item.updatedAt}>{formatTime(item.updatedAt)}</time></span>
              </Link>
            </li>)}</ul>}
    </section>
    <BottomNavView items={navItems} activeKey="message" placement="flow" />
  </main>
}

export function RestoredMessageListPage() {
  const { conversations, loading, error, unreadCount, refresh } = useRestoredMessages()
  const [query, setQuery] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = restoredMessageTabFromSearch(searchParams.toString())
  return <RestoredMessageListView conversations={conversations} loading={loading} error={error} unreadCount={unreadCount} query={query} tab={tab} onQueryChange={setQuery} onTabChange={next => {
    setSearchParams(previous => { const params = new URLSearchParams(previous); if (next === 'all') params.delete('tab'); else params.set('tab', next); return params })
  }} onRefresh={() => { void refresh() }} />
}

function MessageItem({ item }: { item: RestoredImMessage }) {
  const unsupported = unsupportedLabel(item)
  const isOwnMemberMessage = item.isMine && (item.senderRole === 'BUYER' || item.senderRole === 'SELLER')
  if (item.senderRole === 'SYSTEM' || item.type === 'SYSTEM') return <li className="restored-message-system"><span>{item.content}</span>{unsupported && <small className="restored-message-unsupported">{unsupported}</small>}<time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time></li>
  return <li className={`restored-message-bubble${isOwnMemberMessage ? ' mine' : ''}${item.senderRole === 'SERVICE' || item.senderRole === 'AI' ? ' restored-message-bubble--service' : ''}`}>
    <b>{senderLabel(item)}</b>
    <p>{item.content}</p>
    {unsupported && <small className="restored-message-unsupported">{unsupported}</small>}
    <time dateTime={item.createdAt}>{formatTime(item.createdAt)}</time>
  </li>
}

export function RestoredConversationView({ conversation, messages, loading, error, hasMore, loadingEarlier, sending, sendState, sendError, onLoadEarlier, onRefresh, onSend, onRetryUnknown }: {
  conversation: RestoredImConversation | null
  messages: RestoredImMessage[]
  loading: boolean
  error: string | null
  hasMore: boolean
  loadingEarlier: boolean
  sending: boolean
  sendState: RestoredConversationSendState
  sendError: string | null
  onLoadEarlier: () => void
  onRefresh: () => void
  onSend: (content: string) => void | Promise<void>
  onRetryUnknown: () => void | Promise<void>
}) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState('')
  const previousSendState = useRef(sendState)
  const submittedText = useRef('')
  const sentCompleted = useRef(false)
  const logRef = useRef<HTMLElement>(null)
  const nearBottom = useRef(true)
  const previousLatest = useRef<number | null>(null)
  const prependPosition = useRef<{ height: number; top: number } | null>(null)
  useEffect(() => {
    if (previousSendState.current === 'sending' && sendState === 'idle') {
      const submitted = submittedText.current
      setDraft(current => current === submitted ? '' : current)
      sentCompleted.current = true
    }
    previousSendState.current = sendState
  }, [sendState])
  useEffect(() => {
    const log = logRef.current
    if (!log || messages.length === 0) return
    const latest = messages.at(-1)!.sequence
    const action = restoredMessageScrollAction({ hadMessages: previousLatest.current !== null, latestChanged: previousLatest.current !== latest, nearBottom: nearBottom.current, prepending: prependPosition.current !== null, loadingEarlier, sentCompleted: sentCompleted.current })
    if (action === 'defer') return
    if (action === 'preserve' && prependPosition.current) log.scrollTop = prependPosition.current.top + (log.scrollHeight - prependPosition.current.height)
    else if (action === 'latest') log.scrollTop = log.scrollHeight
    previousLatest.current = latest
    prependPosition.current = null
    sentCompleted.current = false
  }, [messages, loadingEarlier, sendState])
  const disabledReason = conversation?.sendDisabledReason ? disabledReasonLabels[conversation.sendDisabledReason] : conversation?.status === 'CLOSED' ? '会话已关闭' : null
  const stale = Boolean(error && messages.length > 0)
  const composerDisabled = !conversation?.canSend || Boolean(disabledReason) || stale
  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!canSubmitRestoredMessage({ draft, sending, composerDisabled, sendState })) return
    submittedText.current = draft
    void onSend(draft)
  }
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!shouldSubmitRestoredMessageKey({ key: event.key, shiftKey: event.shiftKey, isComposing: event.nativeEvent.isComposing })) return
    event.preventDefault(); submit()
  }
  return <main className="restored-conversation-page">
    <PageHeader className="restored-conversation-header" title={conversation?.title || '会话'} left={<IconButton label="返回消息" onClick={() => navigate('/message')}><ArrowLeft size={21} aria-hidden="true" /></IconButton>} right={<IconButton label="刷新会话" disabled={loading} onClick={onRefresh}><RefreshCw size={18} aria-hidden="true" /></IconButton>}>{conversation ? `${conversationKind(conversation)} · ${conversation.myRole === 'BUYER' ? '我是买家' : '我是卖家'}` : undefined}</PageHeader>
    {conversation && <section className="restored-conversation-association" aria-label="会话关联业务">
      <b>{conversation.association.kind === 'TRADE' ? `订单 ${conversation.association.orderNo}` : `回收咨询 ${conversation.association.consultationId}`}</b>
      {conversation.association.kind === 'TRADE'
        ? <span>履约 {conversation.association.fulfillment.id} · {conversation.association.fulfillment.status}</span>
        : <span>回收商 {conversation.association.recyclerId}{conversation.association.recycleOrderId ? ` · 回收单 ${conversation.association.recycleOrderId}` : ' · 尚未建立回收单'}{conversation.association.recycleOrderStatus ? ` · ${conversation.association.recycleOrderStatus}` : ''} · <Link to={`/recycle/consultations/${encodeURIComponent(conversation.association.consultationId)}`}>查看咨询资料</Link></span>}
    </section>}
    {conversation && conversation.association.kind === 'RECYCLE' && <RestoredRecycleOrderPanel consultationId={conversation.association.consultationId} associationRecyclerId={conversation.association.recyclerId} associationStatus={conversation.association.recycleOrderStatus} />}
    <section ref={logRef} className="restored-conversation-log" aria-label="消息记录" aria-busy={loading} onScroll={event => {
      const element = event.currentTarget
      nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64
    }}>
      {error && messages.length > 0 && <div className="restored-message-stale" role="status"><b>当前消息可能已过期</b><span>{error}</span><Button size="xs" variant="outline" onClick={onRefresh}>重试</Button></div>}
      {loading && messages.length === 0 ? <div className="restored-message-state" role="status"><Spinner />正在加载消息…</div>
        : error && messages.length === 0 ? <div className="restored-message-state" role="alert"><p>{error}</p><Button onClick={onRefresh}>重新加载</Button></div>
          : <>{hasMore && <Button className="restored-load-earlier" size="sm" variant="outline" disabled={loadingEarlier} onClick={() => {
            const log = logRef.current
            if (log) prependPosition.current = { height: log.scrollHeight, top: log.scrollTop }
            onLoadEarlier()
          }}>{loadingEarlier ? '加载中…' : '加载更早消息'}</Button>}{messages.length === 0 ? <div className="restored-message-state"><p>暂无消息</p></div> : <ol>{messages.map(item => <MessageItem item={item} key={item.id} />)}</ol>}</>}
    </section>
    <form className="restored-conversation-composer" onSubmit={submit}>
      <div><TextAreaField className="restored-message-draft" id="restored-message-draft" label="消息内容" aria-label="消息内容" rows={1} value={draft} maxLength={2_000} disabled={composerDisabled} placeholder={disabledReason || (stale ? '数据过期，刷新后可发送' : '输入消息')} onChange={event => setDraft(event.target.value)} onKeyDown={keyDown} /><IconButton label="发送消息" type="submit" disabled={composerDisabled || sending || sendState === 'unknown' || !draft.trim()}><Send size={19} aria-hidden="true" /></IconButton></div>
      <p className="restored-composer-status" aria-live="polite">{sendError || disabledReason || (stale ? '刷新成功前已禁用发送' : sending ? '正在发送…' : '按 Enter 发送，Shift + Enter 换行')}</p>
      {sendState === 'unknown' && <Button size="sm" variant="outline" type="button" onClick={() => { void onRetryUnknown() }}>重试原操作</Button>}
    </form>
  </main>
}

export function RestoredConversationPage() {
  const { conversationId = '' } = useParams<{ conversationId: string }>()
  const state = useRestoredConversation(conversationId)
  const stableMessages = useMemo(() => state.messages.slice().sort((left, right) => left.sequence - right.sequence), [state.messages])
  return <RestoredConversationView key={conversationId} conversation={state.conversation} messages={stableMessages} loading={state.loading} error={state.error} hasMore={state.hasMore} loadingEarlier={state.loadingEarlier} sending={state.sendState === 'sending'} sendState={state.sendState} sendError={state.sendError} onLoadEarlier={() => { void state.loadEarlier() }} onRefresh={() => { void state.refresh() }} onSend={state.send} onRetryUnknown={state.retryUnknown} />
}
