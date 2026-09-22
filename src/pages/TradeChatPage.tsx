import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronLeft, CirclePlus, FileText, ShieldCheck, X } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { TradeHistory } from '../components/TradeHistory'
import { Heading, TextField, TextAreaField, ChoiceChip } from '../components/ui'
import { DesignPromptTrigger } from '../components/DesignPromptTrigger'
import { resolveTradeChatNodeId } from '../data/messagePageSpecs'
import { getOrderWorkflowPhase, isOrderReleaseReady } from '../components/orderModel'
import { getConversationPhase, getTradePhaseTitle, getTradeProgress, isOrderConversationMatch, isTradePhase, isTradePreviewMode, nextTradePhase, tradePhases, validateTradeIssue, type TradeAction, type TradePhase, type TradeRole } from '../components/tradeFlowModel'
import { messageRepository } from '../repository/messageRepository'
import { orderRepository } from '../repository/orderRepository'
import type { Conversation, ConversationMessage } from '../types/message'
import type { OrderRecord, OrderStatus } from '../types/order'
import '../styles/trade-chat-draft3.css'

type Sheet = TradeAction | 'phone' | 'view_issue' | 'preview' | 'issue_success' | null
const ISSUE_TYPES = ['资产与描述不符', '无法登录', '换绑受限', '对方失联']
const phaseStatus: Partial<Record<TradePhase, OrderStatus>> = { inspection: 'verifying', binding: 'binding', signed: 'signed', release: 'bind_success', completed: 'completed' }

export function TradeChatPage({ conversation }: { conversation: Conversation }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const routeOrderId = params.get('orderId')
  const requestedOrderId = routeOrderId ?? conversation.orderId ?? null
  const requestedRole = params.get('role') === 'seller' ? 'seller' : params.get('role') === 'buyer' ? 'buyer' : null
  const previewPhase = params.get('phase')
  const isHistory = Boolean(conversation.historyPreview && conversation.closed)
  const previewMode = !isHistory && isTradePreviewMode(params.get('scenario'), previewPhase)
  const [order, setOrder] = useState<OrderRecord | undefined>(() => requestedOrderId ? orderRepository.get(requestedOrderId) : undefined)
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [sheet, setSheet] = useState<Sheet>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [text, setText] = useState('')
  const [account, setAccount] = useState('wz_player_0908')
  const [password, setPassword] = useState('DemoPass2026')
  const [revealed, setRevealed] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneSubmitted, setPhoneSubmitted] = useState(false)
  const [issueType, setIssueType] = useState('')
  const [issueText, setIssueText] = useState('')
  const [issueFiles, setIssueFiles] = useState<File[]>([])
  const [images, setImages] = useState<string[]>([])
  const imageUrls = useRef<string[]>([])
  imageUrls.current = images
  const [cooldown, setCooldown] = useState(false)
  const sheetRef = useRef<HTMLElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const validOrder = isOrderConversationMatch(order, conversation, requestedOrderId)
  const activeOrder = validOrder ? order : undefined
  const role: TradeRole = previewMode && requestedRole ? requestedRole : activeOrder?.role ?? conversation.viewerRole ?? 'buyer'
  const basePhase = activeOrder ? getOrderWorkflowPhase(activeOrder.status) : getConversationPhase(conversation)
  const phase: TradePhase = previewMode && isTradePhase(previewPhase) ? previewPhase : activeOrder?.pausedPhase ? 'paused' : basePhase
  const progress = getTradeProgress(phase, (activeOrder?.insuranceAmountCents ?? 0) > 0, activeOrder?.pausedPhase ?? conversation.pausedPhase)
  const step = progress.current
  const amount = (activeOrder ? activeOrder.goodsAmountCents / 100 : conversation.orderAmount ?? 1280).toLocaleString('zh-CN')
  const title = activeOrder ? `${activeOrder.gameName} ${activeOrder.server}` : conversation.title.replace(/ · .*$/, '')
  const terminal = phase === 'closed' || Boolean(conversation.closed)
  const open = (next: Sheet) => { setError(''); setSheet(next) }

  useEffect(() => {
    const sync = () => { void messageRepository.listMessages(conversation.id).then(setMessages) }
    sync(); return messageRepository.subscribe(sync)
  }, [conversation.id])
  useEffect(() => {
    if (!requestedOrderId) { setOrder(undefined); return }
    const sync = () => setOrder(orderRepository.get(requestedOrderId))
    sync(); return orderRepository.subscribe(sync)
  }, [requestedOrderId])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2200); return () => window.clearTimeout(timer) }, [toast])
  useEffect(() => { if (!cooldown) return; const timer = window.setTimeout(() => setCooldown(false), 10000); return () => window.clearTimeout(timer) }, [cooldown])
  useEffect(() => {
    if (!sheet) return
    const previous = document.activeElement as HTMLElement | null
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setSheet(null)
      if (event.key === 'Tab') {
        const nodes = [...(sheetRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, a[href]') ?? [])]
        if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus() }
        if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus() }
      }
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); previous?.focus({ preventScroll: true }) }
  }, [sheet, busy])
  useEffect(() => () => imageUrls.current.forEach(url => URL.revokeObjectURL(url)), [])

  const send = async (content = text) => {
    if (!content.trim() || terminal || busy) return
    setBusy(true)
    const result = await messageRepository.sendText(conversation.id, content)
    setBusy(false)
    if (!result.ok) { setToast('消息发送失败，内容已保留，请重试'); return }
    setText('')
    requestAnimationFrame(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }))
  }
  const remind = (target: string) => {
    if (cooldown) return
    setCooldown(true); void send(`请${target}查看当前交易并处理。`)
    setToast(`已提醒${target}`)
  }
  const applyAction = async (action: TradeAction) => {
    if (terminal) return
    const next = nextTradePhase(phase, role, action)
    if (!next) { setError('当前状态不能执行此操作'); return }
    if (action === 'report_issue') {
      const validation = validateTradeIssue(issueType, issueText, issueFiles)
      if (validation) { setError(validation); return }
    }
    setBusy(true); setError('')
    await new Promise(resolve => window.setTimeout(resolve, 400))
    let ok = true
    if (params.get('scenario') === 'submit-error') ok = false
    else if (previewMode) {
      const nextParams = new URLSearchParams(params); nextParams.set('phase', next); setParams(nextParams, { replace: true })
    } else {
      if (!activeOrder) ok = false
      else if (next === 'paused') {
        const pausedPhase = phase as Exclude<TradePhase, 'completed' | 'paused' | 'closed'>
        ok = orderRepository.pause(activeOrder.id, pausedPhase)
        if (ok) ok = await messageRepository.syncWorkflow({ conversationId: conversation.id, orderId: activeOrder.id, phase: 'paused', role, pausedPhase })
      } else {
        const nextStatus = phaseStatus[next]
        ok = Boolean(nextStatus) && (next === 'completed'
          ? orderRepository.confirmReceipt(activeOrder.id)
          : orderRepository.advance(activeOrder.id, nextStatus!))
        if (ok) ok = await messageRepository.syncWorkflow({ conversationId: conversation.id, orderId: activeOrder.id, phase: next, role })
      }
    }
    setBusy(false)
    if (!ok) { setError('提交失败，内容已保留，请重试'); return }
    setSheet(action === 'report_issue' ? 'issue_success' : null)
    if (action === 'finish_inspection') open('phone')
    if (action === 'release_funds') setToast('已确认放款，交易完成')
  }
  const savePhone = () => {
    if (!/^1\d{10}$/.test(phone)) { setError('请输入 11 位手机号'); return }
    setPhoneSubmitted(true); setSheet(null); setToast('换绑手机号已提交')
  }
  const startMaterials = () => {
    if (!account.trim() || !password.trim()) { setToast('请填写账号和初始密码'); return }
    open('submit_materials')
  }
  const hasActionContext = previewMode || validOrder
  const canRelease = previewMode ? phase === 'release' : Boolean(activeOrder && isOrderReleaseReady(activeOrder))
  const canAct = hasActionContext && ((phase === 'materials' && role === 'seller') || (phase === 'inspection' && role === 'buyer') || (phase === 'binding' && role === 'seller') || (phase === 'release' && role === 'buyer' && canRelease))
  const issueButton = <button type="button" className="trade-d3-secondary" disabled={!hasActionContext} onClick={() => open('report_issue')}>{phase === 'release' ? '验号不符' : '异常'}</button>
  const dataValue = (key: string, value: string) => <><b>{revealed === key ? value : '***'}</b><button type="button" onClick={() => setRevealed(revealed === key ? '' : key)}>{revealed === key ? '收起' : '查看'}</button></>

  return <main className={`group-chat-page trade-d3-page phase-${phase}`} data-node-id={phase === 'materials' ? role === 'seller' ? '3993:127' : '3993:578' : phase === 'inspection' ? role === 'seller' ? '3993:242' : '3993:684' : phase === 'binding' ? role === 'seller' ? '3993:366' : '3993:807' : phase === 'release' ? '3993:916' : phase === 'paused' ? '3993:1038' : '3993:475'}>
    <header className="trade-d3-header"><DesignPromptTrigger nodeId={resolveTradeChatNodeId(phase, role)} className="chat-status" /><div className="trade-d3-topbar"><button type="button" aria-label="返回消息" onClick={() => navigate('/message?tab=groups')}><ChevronLeft size={21} /></button><button type="button" className="trade-d3-title" aria-label={isHistory ? "已关闭交易群信息" : "交易群信息与预览状态"} disabled={isHistory} onClick={() => open('preview')}><Heading as="h1" variant="page">交易群 · {title}</Heading></button></div><Link className="trade-d3-order-summary" to={activeOrder ? `/orders/${activeOrder.id}` : '/orders'} aria-label="查看订单详情"><img src={activeOrder?.thumbnail || assetPath(`assets/games/${conversation.gameCode === 'sjzxd' ? 'delta' : conversation.gameCode === 'ys' ? 'genshin' : conversation.gameCode ?? 'wzry'}.png`)} alt="" /><span><b>{activeOrder?.productTitle ?? conversation.productCode ?? title}</b><small>{activeOrder?.id ?? conversation.orderId}</small></span><strong>¥{amount}</strong></Link></header>
    {isHistory ? <section className="trade-d3-progress" aria-label="会话已关闭，交易已完成"><div><b>会话已关闭 · 交易已完成</b><small>历史记录仅供查看</small></div></section> : <section className="trade-d3-progress" aria-label={`步骤 ${step} / ${progress.total}，${getTradePhaseTitle(phase, role)}`}><div><b>{phase === 'paused' && <em>已暂停</em>}步骤 {step} / {progress.total} · {getTradePhaseTitle(phase, role)}</b><small>{phase === 'release' ? '剩 61:04:22' : phase === 'completed' ? '09-09 11:38' : `已 ${step === 1 ? '2' : step === 2 ? '7' : '22'} 分钟`}</small></div><ol aria-hidden="true">{Array.from({ length: progress.total }, (_, index) => index + 1).map(i => <li key={i} className={i < step || phase === 'completed' ? 'done' : i === step ? 'current' : ''} />)}</ol></section>}
    <div ref={logRef} className="trade-d3-log" role="log" aria-label="交易群内容">
      {isHistory ? <TradeHistory conversation={conversation} messages={messages} /> : <>
      {!previewMode && !validOrder && <section className="trade-d3-card"><Heading as="h2" variant="section">仅可查看会话记录</Heading><p>{routeOrderId ? '订单与当前交易群不匹配，已禁用履约与放款操作。' : '当前会话没有可验证的订单，已禁用履约与放款操作。可通过显式预览状态查看界面。'}</p></section>}
      {phase === 'materials' ? <><time className="trade-d3-time">09-09 10:02</time><div className="trade-d3-history"><ShieldCheck size={13} />{role === 'seller' ? '买家' : '你'}已付款 <b>¥{amount}</b>，资金进入平台托管</div></> : phase !== 'paused' && <div className="trade-d3-history"><Check size={14} />{phase === 'inspection' ? '资料同步 · 已完成' : phase === 'binding' ? '买家验号完成 · 已进入换绑' : phase === 'signed' ? '换绑完成 · 协议签署完成' : phase === 'insuring' ? '协议已签署 · 平台正在投保' : phase === 'insured' ? '投保成功 · 保障已生效' : phase === 'release' ? '换绑与保障流程完成 · 等待买家确认放款' : phase === 'completed' ? '保障流程完成 · 已确认放款' : '交易已关闭'}</div>}
      {phase === 'inspection' && <section className="trade-d3-card"><Heading as="h2" variant="section"><FileText size={14} />{role === 'seller' ? '资料同步' : '卖家提交的账号资料'}<em>已同步</em></Heading><div className="trade-d3-data"><span>账号</span>{dataValue('account', account)}</div><div className="trade-d3-data"><span>初始密码</span>{dataValue('password', password)}</div></section>}
      {phase === 'binding' && <section className="trade-d3-card"><Heading as="h2" variant="section">{role === 'seller' ? '买家提交的换绑手机号' : '你提交的换绑手机号'}<em>{phoneSubmitted || role === 'seller' ? '已提交' : '待提交'}</em></Heading><div className="trade-d3-data"><span>换绑手机号</span><b>{phoneSubmitted ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : role === 'seller' ? '187****0033' : '未填写'}</b><button type="button" onClick={() => role === 'seller' ? setToast('演示手机号：187****0033') : open('phone')}>{role === 'seller' ? '查看' : phoneSubmitted ? '修改' : '填写'}</button></div></section>}
      {phase === 'release' && <section className="trade-d3-card"><Heading as="h2" variant="section"><FileText size={14} />交付核对</Heading>{[['账号资料一致', '已核对 ✓'], ['已换绑至你的手机号', '已完成 ✓'], ['资产与协商内容一致', '待你确认']].map(([label, value], i) => <div key={label} className="trade-d3-data"><span>{label}</span><b className={i < 2 ? 'success' : 'pending'}>{value}</b></div>)}</section>}
      {(['signed', 'insuring', 'insured'] as TradePhase[]).includes(phase) && <section className="trade-d3-card trade-d3-task"><Heading as="h2" variant="section">{phase === 'signed' ? '协议签署完成' : phase === 'insuring' ? '平台投保中' : '投保成功'}</Heading><p>{phase === 'signed' ? (activeOrder?.insuranceAmountCents ?? 0) > 0 ? '平台正在核对签署结果，随后发起包赔投保。' : '本订单不含包赔服务，平台核对后进入待放款。' : phase === 'insuring' ? '保单提交处理中，投保完成前不会向卖家放款。' : '包赔保障已经生效，平台核对完成后进入待放款。'}</p><div className="trade-d3-safe"><ShieldCheck size={14} />当前阶段不可确认放款，请等待平台流程完成</div><footer><button type="button" disabled>等待平台处理</button></footer></section>}
      {!['completed', 'closed', 'paused', 'signed', 'insuring', 'insured'].includes(phase) && <section className={`trade-d3-card trade-d3-task ${canAct && ['inspection', 'release'].includes(phase) ? 'critical' : ''}`}>
        <Heading as="h2" variant="section">{phase === 'materials' ? role === 'seller' ? '资料同步 · 请填写账号资料' : '等卖家同步资料' : phase === 'inspection' ? role === 'seller' ? '等买家验号' : '开始验号，核对账号资产' : phase === 'binding' ? role === 'seller' ? '换绑 · 请按手机号完成换绑' : '等卖家换绑' : role === 'seller' ? '等买家确认放款' : '卖家已完成换绑，请你核对'}</Heading>
        <p>{phase === 'materials' ? role === 'seller' ? '买家已付款，请填写账号与初始密码。提交后买家开始验号。' : '卖家正在填写账号与初始密码，提交后你就可以开始验号。' : phase === 'inspection' ? role === 'seller' ? '买家正在核对账号资料。验号期间请不要登录或修改账号。' : <>按上方账号信息登录核对。确认验号完成后进入换绑，<b>此后不能再以资产不符为由退单。</b></> : phase === 'binding' ? role === 'seller' ? '换绑至买家手机号后点「换绑完成」，买家核对无误即可放款。' : '卖家正在按你的手机号操作换绑，完成后你会收到核对提醒。' : <>确认放款后 <b>¥{amount}</b> 将结算给卖家，此操作不可撤销。</>}</p>
        {phase === 'materials' && role === 'seller' && <><TextField className="trade-d3-field-layout" label="账号 *" value={account} onChange={e => setAccount(e.target.value)} autoComplete="off" /><TextField className="trade-d3-field-layout" label="初始密码 *" value={password} type="password" onChange={e => setPassword(e.target.value)} autoComplete="off" /></>}
        {phase === 'materials' && <aside><b>仅限成年人交易 · 群内禁止提供手机号</b><p>换绑手机号请在「换绑」环节通过表单提交，不要在聊天中发送。</p></aside>}
        {phase === 'inspection' && role === 'buyer' && <aside><b>验号注意</b><p>可二次实名账号，交易中请勿修改任何绑定信息。需要验证码或扫码登录时，在群里找卖家或客服。</p></aside>}
        {phase === 'binding' && role === 'seller' && <><aside><b>换绑前先做两件事</b><p>1 · 删除账号中原有的人脸等身份信息<br />2 · 按 QQ 风控要求间隔操作，避免触发限制</p></aside><div className="trade-d3-safe"><ShieldCheck size={14} />买家的 ¥{amount} 在平台托管，换绑完成并确认后结算给你</div></>}
        {phase === 'release' && <><p className="trade-d3-countdown">72小时后系统自动确认 · 剩 <b>61:04:22</b></p><div className="trade-d3-safe"><ShieldCheck size={14} />在你确认前，¥{amount} 一直由平台托管</div></>}
        <footer>{issueButton}{!canAct ? <button type="button" disabled>等待{role === 'buyer' ? '卖家' : '买家'}操作</button> : <button type="button" className="primary" onClick={() => phase === 'materials' ? startMaterials() : open(phase === 'inspection' ? 'finish_inspection' : phase === 'binding' ? 'finish_binding' : 'release_funds')}>{phase === 'materials' ? '资料同步' : phase === 'inspection' ? '验号完成' : phase === 'binding' ? '换绑完成' : '确认放款'}</button>}</footer>
      </section>}
      {phase === 'paused' && <><div className="trade-d3-paused-note"><b>你已提交异常 · 交易已暂停</b><p>问题类型：{issueType || '账号资产与描述不一致'} · 等待平台核实</p></div><div className="trade-d3-history">客服主管已接入，将由主管继续处理</div><SupportBubble>我看了下这笔订单的记录，接下来由我跟进。</SupportBubble><section className="trade-d3-card trade-d3-task"><Heading as="h2" variant="section">交易已暂停，等待人工处理</Heading><p>正常流程已停止，验号 / 换绑 / 放款按钮在处理完成前不可操作。</p><div className="trade-d3-safe"><ShieldCheck size={14} />处理期间 ¥{amount} 保持平台托管，不会自动放款</div><footer><button type="button" onClick={() => open('view_issue')}>查看异常</button><button type="button" disabled>等待客服处理</button></footer></section></>}
      {phase === 'completed' && <><section className="trade-d3-card trade-d3-completed"><i><Check size={25} /></i><Heading as="h2" variant="section">交易完成</Heading><p>账号已交付，<b>¥{amount}</b> 已结算给卖家。</p><dl><div><dt>确认放款</dt><dd>09-09 11:38</dd></div><div><dt>售后有效期至</dt><dd>09-16</dd></div></dl></section><SupportBubble>这笔交易已完成，群会保留 7 天。有问题可以在这里找我。</SupportBubble><p className="trade-d3-muted">交易已结束，本群不再有待办操作</p></>}
      {phase === 'closed' && <section className="trade-d3-card trade-d3-completed"><Heading as="h2" variant="section">交易已关闭</Heading><p>本群不再有待办操作，可在订单中查看处理结果。</p></section>}
      {phase === 'inspection' && <SupportBubble>{role === 'buyer' ? '资产和描述不一致就点「异常」，不要先点验号完成。' : '资料已同步给买家，请等待买家核对账号。'}</SupportBubble>}
      {!canAct && !['completed', 'closed', 'paused', 'signed', 'insuring', 'insured'].includes(phase) && <div className="trade-d3-reminders"><button type="button" disabled={cooldown} onClick={() => remind(role === 'buyer' ? '卖家' : '买家')}>催{role === 'buyer' ? '卖家' : '买家'}</button><button type="button" disabled={cooldown} onClick={() => remind('客服')}>催客服</button></div>}
      {messages.filter(message => !['m1', 'm2', 'm3', 'm4'].includes(message.id)).map(message => <div key={message.id} className={`trade-d3-message ${message.sender === 'buyer' ? 'self' : ''}`}><small>{message.senderName}</small><p>{message.content}</p></div>)}
      {images.map(url => <div className="trade-d3-message self" key={url}><img src={url} alt="本地图片预览" /><small>仅在本次预览中展示</small></div>)}
      </>}
    </div>
    <footer className="trade-d3-composer"><button type="button" disabled={terminal} aria-label="添加消息内容" onClick={() => imageRef.current?.click()}><CirclePlus size={21} /></button><input value={text} maxLength={1000} disabled={terminal} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send() }} placeholder={terminal ? '会话已关闭' : '输入消息，@ 可提醒成员…'} aria-label="消息内容" /><button type="button" className="trade-d3-send" disabled={terminal || busy || !text.trim()} aria-label="发送消息" onClick={() => void send()}>发送</button><input type="file" ref={imageRef} accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { setToast('图片不能超过 10MB'); return } setImages(previous => [...previous, URL.createObjectURL(file)]) }} /></footer>
    {sheet && <div className="trade-d3-sheet-layer"><button className="trade-d3-mask" type="button" aria-label="关闭交易操作" disabled={busy} onClick={() => setSheet(null)} /><section className="trade-d3-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="trade-d3-sheet-title"><i className="trade-d3-handle" />
      <Heading id="trade-d3-sheet-title" as="h2" variant="dialog">{sheet === 'submit_materials' ? '确认提交资料' : sheet === 'finish_inspection' ? '确认验号完成' : sheet === 'finish_binding' ? '确认换绑完成' : sheet === 'release_funds' ? '确认放款' : sheet === 'phone' ? '填写换绑手机号' : sheet === 'report_issue' ? '反馈异常' : sheet === 'issue_success' ? '异常已提交' : sheet === 'view_issue' ? '异常详情' : '交易群信息'}</Heading>
      {sheet === 'preview' ? <><p>当前身份：{role === 'buyer' ? '买家' : '卖家'}。以下仅用于本地原型体验，不会持久化订单或放款状态。</p><Heading as="h3" variant="subsection">切换预览身份</Heading><div className="trade-d3-choice">{(['buyer', 'seller'] as const).map(item => <button type="button" key={item} className={role === item ? 'selected' : ''} onClick={() => { const next = new URLSearchParams(params); next.set('scenario', 'preview'); next.set('role', item); setParams(next, { replace: true }); setSheet(null) }}>{item === 'buyer' ? '买家' : '卖家'}</button>)}</div><Heading as="h3" variant="subsection">查看流程状态</Heading><div className="trade-d3-choice">{tradePhases.map(item => <button type="button" key={item} onClick={() => { const next = new URLSearchParams(params); next.set('phase', item); setParams(next, { replace: true }); setSheet(null) }}>{getTradePhaseTitle(item, role)}</button>)}</div><button className="trade-d3-wide" type="button" onClick={() => { const next = new URLSearchParams(params); next.delete('phase'); next.delete('scenario'); next.delete('role'); setParams(next, { replace: true }); setSheet(null) }}>返回当前交易状态</button></> : <>
      {sheet === 'submit_materials' && <><p>提交后买家将开始验号，期间请不要登录或修改账号。</p><div className="trade-d3-review"><div>账号<b>***</b></div><div>初始密码<b>***</b></div></div></>}
      {sheet === 'finish_inspection' && <><p>请确认已完成账号核验。确认后进入换绑环节。</p><aside>确认后不能再以资产与描述不符为由退单。</aside></>}
      {sheet === 'finish_binding' && <><p>请确认已按买家提交的手机号完成换绑。确认后将由买家核对交付结果。</p><aside>不要在买家核对期间登录或修改账号。</aside></>}
      {sheet === 'release_funds' && <><p>请核对账号交付情况后再确认。</p><div className="trade-d3-amount">放款金额<strong>¥{amount}</strong></div><aside>请先确认账号资料、换绑结果与协商内容一致。确认后资金立即结算给卖家，不可撤销。</aside></>}
      {sheet === 'phone' && <><p>请填写用于本次账号换绑的手机号，提交后请留意交易群消息。</p><TextField label="换绑手机号 *" leading="+86" className="trade-d3-field-layout" inputMode="tel" maxLength={11} value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} aria-label="换绑手机号" placeholder="请输入手机号" /></>}
      {sheet === 'report_issue' && <><p>提交后交易暂停，由平台客服介入核实，资金保持托管。</p><Heading as="h3" variant="subsection">问题类型 <em>*</em></Heading><div className="trade-d3-choice">{ISSUE_TYPES.map(type => <ChoiceChip key={type} selected={issueType === type} onClick={() => setIssueType(type)}>{type}</ChoiceChip>)}</div><TextAreaField className="trade-d3-field-layout" label="问题描述 *" showCount maxLength={500} value={issueText} placeholder="请详细描述问题，便于客服核实" onChange={e => setIssueText(e.target.value)} /><Heading as="h3" variant="subsection">上传资料 <small>最多6张 · 单张≤10MB</small></Heading><div className="trade-d3-uploads">{issueFiles.map((file, index) => <div key={`${file.name}-${index}`}><FileText size={22} /><small>{file.name}</small><button type="button" aria-label={`移除凭证${index + 1}`} onClick={() => setIssueFiles(files => files.filter((_, i) => i !== index))}><X size={12} /></button></div>)}{issueFiles.length < 6 && <button type="button" onClick={() => fileRef.current?.click()}><CirclePlus size={23} /><small>{issueFiles.length}/6</small></button>}</div><input type="file" ref={fileRef} hidden multiple accept="image/jpeg,image/png,image/webp" onChange={e => { const files = [...issueFiles, ...Array.from(e.target.files ?? [])]; const issue = validateTradeIssue(issueType || '类型', issueText || '说明', files); if (issue) setError(issue); else { setIssueFiles(files); setError('') } e.target.value = '' }} /></>}
      {sheet === 'issue_success' && <><div className="trade-d3-success-mark"><Check size={28} /></div><p>交易已暂停，客服将介入核实。资金保持平台托管。</p></>}
      {sheet === 'view_issue' && <><div className="trade-d3-review"><div>问题类型<b>{issueType || '资产与描述不符'}</b></div><div>处理状态<b>等待客服处理</b></div></div><p>{issueText || '已通知平台核实账号与交易情况。'}</p></>}
      {error && <p className="trade-d3-error" role="alert">{error}</p>}
      <footer>{!['issue_success', 'view_issue'].includes(sheet) && <button type="button" disabled={busy} onClick={() => setSheet(null)}>取消</button>}<button type="button" className="primary" disabled={busy} onClick={() => sheet === 'phone' ? savePhone() : ['issue_success', 'view_issue'].includes(sheet) ? setSheet(null) : void applyAction(sheet as TradeAction)}>{busy ? '提交中…' : error ? '重试' : sheet === 'release_funds' ? '确认放款' : sheet === 'report_issue' ? '提交' : ['issue_success', 'view_issue'].includes(sheet) ? '完成' : '确认提交'}</button></footer></>}
    </section></div>}
    {toast && <div className="message-v2-toast" role="status">{toast}</div>}
  </main>
}

function SupportBubble({ children }: { children: ReactNode }) {
  return <div className="trade-d3-support"><i>萌</i><div><small>萌萌 <em>平台客服</em></small><p>{children}</p></div></div>
}
