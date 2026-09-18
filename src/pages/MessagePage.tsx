import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { ConversationRow } from '../components/ConversationRow'
import { filterConversations, groupTradeConversations } from '../components/messageModel'
import { messageRepository } from '../repository/messageRepository'
import { orderRepository } from '../repository/orderRepository'
import { recycleRepository } from '../repository/recycleRepository'
import { RecycleConversationRow } from '../components/RecycleConversationRow'
import { getRecycleConversationName, getRecycleConversationStatus } from '../components/recycleConversationModel'
import type { RecycleOrder } from '../types/recycle'
import type { Conversation } from '../types/message'
import type { OrderRecord } from '../types/order'
import { BottomSheet, Heading, SearchField, StatusBar, Tabs, Toast } from '../components/ui'
import { buildSupportEntryRoute, type SupportEntry } from '../components/supportConsultationModel'
import { ChevronRight, HelpCircle, Search, ShoppingBag } from 'lucide-react'
import '../styles/messages-v2.css'
import '../styles/messages-draft3.css'

type MessageTab = 'all' | 'groups' | 'recycle'
const tabs: Array<{ key: MessageTab; label: string }> = [{ key: 'all', label: '全部' }, { key: 'groups', label: '交易群' }, { key: 'recycle', label: '回收群' }]

export function MessagePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState<Conversation[]>(() => messageRepository.getSnapshot().conversations)
  const requestedCategory = searchParams.get('tab')
  const [category, setCategory] = useState<MessageTab>(requestedCategory === 'groups' || requestedCategory === 'recycle' ? requestedCategory : 'all')
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [supportEntryOpen, setSupportEntryOpen] = useState(false)
  const [recycleOrders, setRecycleOrders] = useState(() => recycleRepository.list())
  const [orders, setOrders] = useState(() => orderRepository.list())
  const ordersById = useMemo(() => new Map(orders.map(order => [order.id, order])), [orders])

  const load = useCallback(async () => {
    try {
      const next = await messageRepository.list()
      setConversations(next); setError('')
    } catch { setError('加载消息失败') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load(); return messageRepository.subscribe(() => { void load() }) }, [load])
  useEffect(() => recycleRepository.subscribe(() => setRecycleOrders(recycleRepository.list())), [])
  useEffect(() => orderRepository.subscribe(() => setOrders(orderRepository.list())), [])
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 1800); return () => window.clearTimeout(timer) }, [toast])

  const supportConversation = conversations.find(item => item.kind === 'support')
  const filtered = useMemo(() => {
    const source = filterConversations(conversations, category === 'groups' ? 'groups' : 'all', query).filter(item => item.kind === 'trade_group')
    if (category === 'recycle') return []
    return source
  }, [category, conversations, query])
  const groups = useMemo(() => groupTradeConversations(filtered), [filtered])
  const recycleRows = useMemo(() => recycleOrders.filter(item => [item.id, item.gameName, item.recyclerName, getRecycleConversationName(item), getRecycleConversationStatus(item), item.messages.at(-1)?.content].some(value => value?.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => Number(Boolean(b.historyPreview)) - Number(Boolean(a.historyPreview))), [recycleOrders, query])
  const allRows = useMemo(() => [
    ...filtered.map(item => ({ kind: 'conversation' as const, item })),
    ...recycleRows.map(item => ({ kind: 'recycle' as const, item })),
  ].sort((a, b) => b.item.updatedAt - a.item.updatedAt), [filtered, recycleRows])
  const openRecycle = (item: RecycleOrder) => {
    if (!recycleRepository.markRead(item.id)) { setToast('未读状态保存失败，请稍后重试'); return }
    navigate(`/appraisal/detail?id=${encodeURIComponent(item.id)}`)
  }
  const openConversation = async (conversation: Conversation) => {
    if (conversation.kind === 'support') { setSupportEntryOpen(true); return }
    await messageRepository.markRead(conversation.id)
    navigate(conversation.kind === 'notification' ? '/notifications' : `/im/${conversation.id}`)
  }
  const openSupportEntry = async (entry: SupportEntry) => {
    if (supportConversation) await messageRepository.markRead(supportConversation.id)
    setSupportEntryOpen(false)
    navigate(buildSupportEntryRoute(entry))
  }
  const selectCategory = (next: MessageTab | 'notifications') => {
    if (next === 'notifications') { navigate('/notifications'); return }
    setCategory(next)
    setSearchParams(next === 'all' ? {} : { tab: next }, { replace: true })
  }

  return <main className="message-v2-page message-draft3" data-node-id={category === 'all' ? '4041:3532' : category === 'groups' ? '4041:3715' : '4041:4068'}>
    <header className="message-v2-header">
      <StatusBar className="message-v2-status" />
      <div className="message-v2-title"><Heading as="h1" variant="display">消息</Heading><div className="message-v2-search" role="search"><SearchField value={draftQuery} maxLength={40} onChange={(event) => setDraftQuery(event.target.value)} onClear={() => setDraftQuery('')} onSearch={() => setQuery(draftQuery.trim())} placeholder="搜索消息" aria-label="搜索消息、订单或商品编号" /></div></div>
      <Tabs className="message-v2-tabs" label="消息分类" items={tabs.map((tab) => ({ value: tab.key, label: tab.label }))} value={category} onValueChange={(value) => selectCategory(value as MessageTab)} variant="underline" size="lg" />
    </header>

    <section className="message-v2-scroll" role="tabpanel" aria-label="会话列表">
      {supportConversation && <div className="message-support-section"><ConversationRow item={supportConversation} onOpen={openConversation} /></div>}
      {category !== 'recycle' && loading ? <MessageState label="正在加载消息" loading /> : category !== 'recycle' && error ? <MessageState label={error} action="重试" onAction={() => void load()} /> : <>
        {category === 'recycle' ? recycleRows.length ? <div className="message-conversation-list message-conversation-flat">{recycleRows.map(item => <RecycleConversationRow key={item.id} item={item} onOpen={() => openRecycle(item)} />)}</div> : <MessageState label={query ? '没有匹配的回收咨询' : '暂无回收咨询'} action={query ? undefined : '咨询回收商'} onAction={() => navigate('/sell')} /> : category === 'groups' ? <GroupSections groups={groups} ordersById={ordersById} onOpen={openConversation} /> : allRows.length ? <div className="message-conversation-list message-conversation-flat">{allRows.map(row => row.kind === 'recycle' ? <RecycleConversationRow showTypeBadge item={row.item} key={'recycle-' + row.item.id} onOpen={() => openRecycle(row.item)} /> : <ConversationRow showTypeBadge item={row.item} order={ordersById.get(row.item.orderId ?? '')} key={'conversation-' + row.item.id} onOpen={openConversation} />)}</div> : <MessageState label={query ? '没有匹配的订单或商品消息' : '暂无消息'} />}
      </>}
    </section>
    <BottomNav placement="flow" showGuestPrompt={false} />
    <Toast message={toast} onDismiss={() => setToast('')} />
    <BottomSheet open={supportEntryOpen} onClose={() => setSupportEntryOpen(false)} title="你想咨询哪方面" className="message-support-entry-sheet" showClose>
      <div className="message-support-entry-list">
        <button type="button" className="featured" onClick={() => void openSupportEntry('faq')}><span className="message-support-entry-icon"><HelpCircle size={19} aria-hidden="true" /></span><span><b>FAQ 问答 · 萌萌</b><small>交易规则、换绑、退款、售后流程</small></span><ChevronRight size={18} aria-hidden="true" /></button>
        <button type="button" onClick={() => void openSupportEntry('account')}><span className="message-support-entry-icon"><Search size={19} aria-hidden="true" /></span><span><b>王者荣耀账号咨询 · 萌萌</b><small>段位、皮肤、区服、估价与验号</small></span><ChevronRight size={18} aria-hidden="true" /></button>
        <button type="button" onClick={() => void openSupportEntry('product')}><span className="message-support-entry-icon"><ShoppingBag size={19} aria-hidden="true" /></span><span><b>商品咨询 · 萌萌</b><small>在售账号详情、价格、能否砍价</small></span><ChevronRight size={18} aria-hidden="true" /></button>
      </div>
    </BottomSheet>
  </main>
}

export function GroupSections({ groups, ordersById, onOpen }: { groups: ReturnType<typeof groupTradeConversations>; ordersById: Map<string, OrderRecord>; onOpen: (item: Conversation) => void }) {
  const config = [{ key: 'need_action', label: '需要我处理' }, { key: 'in_progress', label: '进行中' }, { key: 'closed', label: '已完成/已关闭' }] as const
  const count = config.reduce((sum, item) => sum + groups[item.key].length, 0)
  if (!count) return <MessageState label="暂无交易群" />
  const rows = config.flatMap(({ key }) => groups[key])
  const ordered = [...rows.filter(item => item.historyPreview && item.closed), ...rows.filter(item => !(item.historyPreview && item.closed))]
  return <div className="message-conversation-list message-conversation-flat">{ordered.map(item => <ConversationRow item={item} order={ordersById.get(item.orderId ?? '')} key={item.id} onOpen={onOpen} />)}</div>
}
export { ConversationRow } from '../components/ConversationRow'
function MessageState({ label, action, onAction, loading }: { label: string; action?: string; onAction?: () => void; loading?: boolean }) { return <div className="message-v2-state" role={action ? 'alert' : 'status'}>{loading && <i />}<p>{label}</p>{action && <button type="button" onClick={onAction}>{action}</button>}</div> }
