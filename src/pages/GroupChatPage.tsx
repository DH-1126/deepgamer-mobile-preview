import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Camera, CirclePlus, MoreHorizontal, RotateCcw, Send, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { canAdvanceBinding, canSendQuick, createPendingMessage, validateMessageText } from '../components/messageModel'
import { assetPath } from '../components/assetPath'
import { messageRepository } from '../repository/messageRepository'
import { fulfillmentRepository } from '../repository/fulfillmentRepository'
import type { FulfillmentContract } from '../types/fulfillment'
import type { Conversation, ConversationMessage } from '../types/message'
import '../styles/messages-v2.css'

type ConfirmAction = 'binding' | 'mismatch' | null

export function GroupChatPage() {
  const { conversationId = '' } = useParams()
  const navigate = useNavigate()
  const [conversation, setConversation] = useState<Conversation>()
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [pending, setPending] = useState<ConversationMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [validation, setValidation] = useState('')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [toast, setToast] = useState('')
  const [quickSentAt, setQuickSentAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [imagePreview, setImagePreview] = useState('')
  const [contract, setContract] = useState<FulfillmentContract>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pinned, setPinned] = useState(true)
  const [muted, setMuted] = useState(false)
  const [historyCleared, setHistoryCleared] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const lastActionRef = useRef<HTMLElement | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextConversation, nextMessages] = await Promise.all([messageRepository.get(conversationId), messageRepository.listMessages(conversationId)])
      setConversation(nextConversation); setMessages(nextMessages); setError('')
    } catch { setError('会话加载失败，请重试') }
    finally { setLoading(false) }
  }, [conversationId])
  useEffect(() => { void messageRepository.markRead(conversationId).then(load); return messageRepository.subscribe(() => { void load() }) }, [conversationId, load])
  useEffect(() => {
    const refresh = () => { void fulfillmentRepository.getByConversation(conversationId).then(setContract) }
    refresh()
    return fulfillmentRepository.subscribe(refresh)
  }, [conversationId])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 1800); return () => window.clearTimeout(timer) }, [toast])
  useEffect(() => { requestAnimationFrame(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })) }, [messages, pending])
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }, [imagePreview])
  useEffect(() => {
    if (!settingsOpen) return undefined
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSettingsOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = overflow }
  }, [settingsOpen])
  const closeConfirm = useCallback(() => setConfirmAction(null), [])
  useEffect(() => {
    if (!confirmAction) return undefined
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'
    const focusable = () => [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    requestAnimationFrame(() => focusable()[0]?.focus())
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeConfirm(); return }
      if (event.key !== 'Tab') return
      const items = focusable(); if (!items.length) return
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus() }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); document.body.style.overflow = overflow; requestAnimationFrame(() => lastActionRef.current?.focus()) }
  }, [closeConfirm, confirmAction])

  const allMessages = useMemo(() => historyCleared ? [] : [...messages, ...pending].sort((a, b) => a.createdAt - b.createdAt), [historyCleared, messages, pending])
  const structuredMessageIds = useMemo(() => new Set(['m1', 'm2', 'm3']), [])
  const hasStructuredBindingCards = conversation?.id === 'trade-wzry' && messages.some((message) => structuredMessageIds.has(message.id))
  const visibleMessages = useMemo(() => allMessages.filter((message) => !hasStructuredBindingCards || !structuredMessageIds.has(message.id)), [allMessages, hasStructuredBindingCards, structuredMessageIds])
  const back = () => window.history.length > 1 ? navigate(-1) : navigate('/message')
  const send = async (content = text, retryId?: string) => {
    const issue = validateMessageText(content); setValidation(issue); if (issue || !conversation || conversation.closed) return
    setHistoryCleared(false)
    const local = createPendingMessage(conversation.id, content, Date.now(), retryId ?? `local-${Date.now()}`)
    setPending((current) => [...current.filter((item) => item.id !== local.id), local]); if (!retryId) setText('')
    const result = await messageRepository.sendText(conversation.id, content, local.id)
    setPending((current) => result.ok ? current.filter((item) => item.id !== local.id) : current.map((item) => item.id === local.id ? result.message : item))
    if (!result.ok) setToast('发送失败，请重试')
  }
  const quickSend = (target: '客服' | '卖家' | '买家') => {
    if (!canSendQuick(quickSentAt, Date.now())) { setToast('操作太频繁，请稍后'); return }
    setQuickSentAt(Date.now()); void send(`催${target}：请尽快查看并处理当前交易。`)
  }
  const chooseImage = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setToast('请选择图片文件'); return }
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(URL.createObjectURL(file))
  }
  const confirmTradeAction = async () => {
    if (!conversation || !confirmAction) return
    const ok = confirmAction === 'binding' ? await messageRepository.advanceBinding(conversation.id) : await messageRepository.reportMismatch(conversation.id)
    setConfirmAction(null); setToast(ok ? (confirmAction === 'binding' ? '已确认换绑' : '已提交验号不符') : '状态已处理或操作失败')
  }

  if (loading) return <main className="group-chat-page"><div className="chat-state"><i /><p>正在加载会话</p></div></main>
  if (error) return <main className="group-chat-page"><div className="chat-state" role="alert"><h1>会话加载失败</h1><p>{error}</p><button type="button" onClick={() => { setLoading(true); void load() }}>重试</button></div></main>
  if (!conversation) return <main className="group-chat-page"><div className="chat-state"><h1>会话不存在</h1><p>该交易群可能已关闭或编号有误。</p><Link to="/message">返回消息</Link></div></main>
  const cooldown = quickSentAt === null ? 0 : Math.max(0, Math.ceil((10_000 - (now - quickSentAt)) / 1000))
  const bindingAction = canAdvanceBinding(conversation)

  return <main className="group-chat-page">
    <header className="chat-header"><div className="chat-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div><div className={`chat-titlebar ${conversation.kind === 'support' ? 'support-titlebar' : ''}`}><button type="button" onClick={back} aria-label="返回消息"><ArrowLeft size={21} /></button><span><h1>{conversation.kind === 'trade_group' ? `交易群 · ${conversation.title}` : '王者荣耀 · 专属客服'}{conversation.kind === 'support' && <em>官方</em>}</h1><small>{conversation.kind === 'trade_group' ? '买家 · 卖家 · 平台客服萌萌' : '在线 · 服务时间 09:00–24:00'}</small></span>{conversation.kind === 'support' ? <button type="button" className="chat-more-button" onClick={() => setSettingsOpen(true)} aria-label="客服消息设置"><MoreHorizontal size={21} /></button> : conversation.orderId ? <Link to={`/orders/${conversation.orderId}`}>订单</Link> : <span />}</div></header>
    {conversation.kind === 'trade_group' && <section className="chat-progress" aria-label="交易进度"><span><b>{conversation.progressLabel}</b><small>{conversation.elapsedLabel}</small></span><div aria-hidden="true"><i /><i /><i className={conversation.tradeState === 'confirmed' ? 'done' : 'active'} /><i /><i /></div></section>}
    <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-label="聊天记录">
      <time className="chat-day">08-03 14:25</time>
      {conversation.kind === 'trade_group' && <section className="chat-escrow"><i aria-hidden="true">✓</i><b>买家已付款 ¥{conversation.orderAmount?.toLocaleString('zh-CN')}</b><span>资金进入平台托管</span></section>}
      {hasStructuredBindingCards && <section className="chat-material-card" aria-labelledby="material-card-title"><h2 id="material-card-title">资料核对卡 · 卖家需提供</h2><div><span>账号 + 密码</span><b>已提供 ✓</b></div><div><span>换绑手机号</span><b>已提供 ✓</b></div></section>}
      {contract && <Link className={`chat-contract-card state-${contract.status}`} to={`/fulfillment/contracts/${contract.id}`}><span><small>交易履约</small><b>{contract.status === 'signed' ? '回收合同已签署' : '回收合同待签署'}</b><em>#{contract.orderNo} · 本地演示</em></span><strong>{contract.status === 'signed' ? '查看合同' : '去签署'}</strong></Link>}
      {conversation.kind === 'trade_group' && <section className={`chat-trade-action state-${conversation.tradeState}`}><h2>{conversation.tradeState === 'binding' ? '卖家已完成换绑，请你核对' : conversation.tradeState === 'confirmed' ? '换绑已确认，等待完成交易' : conversation.tradeState === 'mismatch' ? '验号不符，客服介入中' : '交易已关闭'}</h2><p>{conversation.tradeState === 'binding' ? <>三项资料均已提供。确认收货后 <b>¥{conversation.orderAmount?.toLocaleString('zh-CN')}</b> 将在约定时间内结算给卖家，此操作不可撤销。</> : '你的资金仍由平台托管，请仅按平台流程处理。'}</p>{conversation.tradeState === 'binding' && <small>72小时后系统自动确认 · 剩 <b>61:04:22</b></small>}{bindingAction && <div><button ref={(node) => { if (node) lastActionRef.current = node }} type="button" onClick={() => setConfirmAction('mismatch')}>验号不符</button><button type="button" onClick={() => setConfirmAction('binding')}>确认换绑</button></div>}</section>}
      {visibleMessages.map((message) => <MessageBubble key={message.id} message={message} onRetry={() => void send(message.content, message.id)} />)}
      {conversation.kind === 'support' && <section className="chat-faq-card" aria-labelledby="chat-faq-title"><h2 id="chat-faq-title">你可能想问</h2>{['购买账号后如何换绑？', '交易资金如何保障？', '如何联系订单客服？'].map((question) => <button type="button" key={question} onClick={() => void send(question)}>{question}<span aria-hidden="true">›</span></button>)}</section>}
    </div>
    <footer className="chat-composer">
      {!conversation.closed && (conversation.kind === 'support' ? <div className="chat-quick-actions support-quick-actions"><button type="button" onClick={() => setToast('感谢你的评价')}>评价客服</button><button type="button" onClick={() => navigate('/game?gameCode=wzry')}>咨询商品</button><button type="button" onClick={() => navigate('/orders?type=bought')}>咨询订单</button><button type="button" onClick={() => navigate('/feedback')}>问题反馈</button></div> : <div className="chat-quick-actions"><button type="button" disabled={cooldown > 0} onClick={() => quickSend('客服')}>催客服{cooldown > 0 ? ` ${cooldown}s` : ''}</button><button type="button" disabled={cooldown > 0} onClick={() => quickSend('卖家')}>催卖家</button><button type="button" disabled={cooldown > 0} onClick={() => quickSend('买家')}>催买家</button></div>)}
      {imagePreview && <div className="chat-image-preview"><img src={imagePreview} alt="待发送图片预览" /><button type="button" onClick={() => { URL.revokeObjectURL(imagePreview); setImagePreview('') }} aria-label="移除图片">×</button><small>仅本地预览，不会上传</small></div>}
      <div className="chat-input-row"><textarea value={text} maxLength={1000} disabled={conversation.closed} placeholder={conversation.closed ? '会话已关闭' : '发消息…'} aria-label="消息内容" aria-invalid={Boolean(validation)} aria-describedby={validation ? 'chat-validation' : undefined} onChange={(event) => { setText(event.target.value); setValidation('') }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } }} /><input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => chooseImage(event.target.files?.[0])} /><button type="button" disabled={conversation.closed} onClick={() => fileRef.current?.click()} aria-label="选择图片"><Camera size={20} /></button><button type="button" disabled={conversation.closed} onClick={() => text.trim() ? void send() : fileRef.current?.click()} aria-label={text.trim() ? '发送消息' : '添加内容'}>{text.trim() ? <Send size={20} /> : <CirclePlus size={23} />}</button></div>
      {validation && <small id="chat-validation" role="alert">{validation}</small>}
    </footer>
    {confirmAction && <div className="chat-confirm-layer"><button type="button" className="chat-confirm-mask" aria-label="取消操作" onClick={closeConfirm} /><section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="chat-confirm-title"><h2 id="chat-confirm-title">{confirmAction === 'binding' ? '确认换绑' : '反馈验号不符'}</h2><p>{confirmAction === 'binding' ? '请确认账号资料、手机号和登录状态均核对无误。确认后交易状态将推进，且不可重复操作。' : '提交后将暂停交易并由平台客服介入，确认继续吗？'}</p><footer><button type="button" onClick={closeConfirm}>取消</button><button type="button" className={confirmAction === 'mismatch' ? 'danger' : 'primary'} onClick={() => void confirmTradeAction()}>{confirmAction === 'binding' ? '确认换绑' : '提交不符'}</button></footer></section></div>}
    {conversation.kind === 'support' && settingsOpen && <div className="chat-settings-layer"><button type="button" className="chat-settings-mask" aria-label="关闭消息设置" onClick={() => setSettingsOpen(false)} /><section role="dialog" aria-modal="true" aria-labelledby="chat-settings-title"><header><h2 id="chat-settings-title">消息设置</h2><button type="button" onClick={() => setSettingsOpen(false)} aria-label="关闭"><X size={20} /></button></header><div className="chat-setting-list"><div><span><b>置顶消息</b></span><button type="button" role="switch" aria-checked={pinned} className={pinned ? 'active' : ''} onClick={() => setPinned((value) => !value)}><i /></button></div><div><span><b>消息免打扰</b></span><button type="button" role="switch" aria-checked={muted} className={muted ? 'active' : ''} onClick={() => setMuted((value) => !value)}><i /></button></div><button type="button" onClick={() => { setSettingsOpen(false); setToast('投诉入口已打开') }}><span><b>投诉服务</b></span><em aria-hidden="true">›</em></button><button type="button" onClick={() => navigate('/feedback')}><span><b>问题反馈</b></span><em aria-hidden="true">›</em></button></div><button type="button" className="chat-clear-history" onClick={() => { setMessages([]); setPending([]); setHistoryCleared(true); setSettingsOpen(false); setToast('已清空本地聊天记录') }}>清空聊天记录</button></section></div>}
    {toast && <div className="message-v2-toast" role="status">{toast}</div>}
  </main>
}

function MessageBubble({ message, onRetry }: { message: ConversationMessage; onRetry: () => void }) {
  if (message.kind === 'system') return <div className="chat-system-message"><span>{message.content}</span></div>
  if (message.sender === 'support') return <div className="chat-support-row"><span aria-hidden="true">萌</span><div className="chat-bubble sender-support"><b>{message.senderName.includes('·') ? <><span>萌萌</span><em>平台客服</em></> : message.senderName}</b><p>{message.content}</p></div></div>
  return <div className={`chat-bubble sender-${message.sender} delivery-${message.delivery}`}><b>{message.senderName}</b><p>{message.content}</p>{message.delivery === 'sending' && <small>发送中…</small>}{message.delivery === 'failed' && <button type="button" onClick={onRetry}><RotateCcw size={13} />发送失败，重试</button>}</div>
}
