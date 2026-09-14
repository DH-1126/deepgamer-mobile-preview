import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, ChevronRight, FileCheck2, FileText, MessagesSquare, MoreVertical, Plus, RefreshCw, ShieldAlert, ShieldCheck, X, Zap } from 'lucide-react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { Button, EmptyStateView, Heading, IconButton, PageHeader, SearchField, StatusBar, TextAreaField, TextField, Toast } from '../components/ui'
import { RecyclerCard } from '../components/RecyclerCard'
import { GameAccessRequestDialog } from '../components/GameAccessRequestDialog'
import { getRecycleConversationName, getRecycleUnreadCount } from '../components/recycleConversationModel'
import { createRecycleConversation, createRecyclePaidOrderRecord, getRecyclePayableCents, getRecycleStatusLabel, isRecycleViewerRole, validateRecycleOrderDraft, type RecycleViewerRole } from '../components/recycleModel'
import { availableRecyclers, filterSellGames, formatRecycleCountdown, validateConsultationText } from '../components/sellModel'
import { recyclerFixtures, sellGames } from '../data/sellFixtures'
import { messageRepository } from '../repository/messageRepository'
import { RecycleHistory } from '../components/RecycleHistory'
import { orderRepository } from '../repository/orderRepository'
import { recycleRepository } from '../repository/recycleRepository'
import { sellRepository } from '../repository/sellRepository'
import type { RecycleOrder, RecycleOrderDraft } from '../types/recycle'
import type { Recycler, SellGame, SellGameCode } from '../types/sell'
import '../styles/sell-v2.css'

function BackTitle({ title, subtitle, fallback = '/profile', menu = false }: { title: string; subtitle?: string; fallback?: string; menu?: boolean }) { const navigate = useNavigate(); return <><StatusBar className="sell-v2-status" /><PageHeader className="sell-page-header" bordered={false} title={title} left={<IconButton label="返回" onClick={() => window.history.length > 1 ? navigate(-1) : navigate(fallback)}><ArrowLeft size={20} /></IconButton>} right={menu ? <IconButton label="更多操作"><MoreVertical size={20} /></IconButton> : undefined}>{subtitle}</PageHeader></> }
function GameButton({ game, onChoose }: { game: SellGame; onChoose: (game: SellGame) => void }) { return <button type="button" className={`dg-ui-focus${!game.consultationCount ? ' unavailable' : ''}`} onClick={() => onChoose(game)}><i style={{ background: game.color }}>{game.image ? <img src={assetPath(game.image)} alt="" /> : game.mark}</i><b>{game.name}</b><small>{game.consultationCount ? <><em>{game.consultationCount}</em> 家可咨询</> : '暂无回收商'}</small></button> }

export function SellPage() {
  const [requestOpen, setRequestOpen] = useState(false)
  const navigate = useNavigate(); const [draftQuery, setDraftQuery] = useState(''); const [query, setQuery] = useState(''); const [toast, setToast] = useState(''); const recent = sellGames.filter((game) => game.featured); const hot = filterSellGames(query ? sellGames : sellGames.filter((game) => !game.featured), query)
  const choose = (game: SellGame) => { if (!game.consultationCount) return setToast('该游戏暂无回收商'); if (!sellRepository.selectGame(game.code)) return setToast('选择保存失败，请重试'); navigate(`/appraisal?game=${game.code}`) }
  return <main className="sell-v2-page sell-v2-games-page">
    <header className="sell-v2-recycle-hero">
      <StatusBar />
      <div className="sell-v2-recycle-nav"><IconButton label="返回" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/profile')}><ArrowLeft size={20} aria-hidden="true" /></IconButton></div>
      <div className="sell-v2-recycle-brand">
        <div className="sell-v2-recycle-copy"><Heading as="h1" variant="hero">账号回收 <span>· 秒拿钱</span></Heading><p className="sell-v2-recycle-benefits" aria-label="高价回收，安全换绑，极速到账，0手续费"><span>高价回收</span><span>安全换绑</span><span>极速到账</span><span>0手续费</span></p></div>
        <img src={assetPath('assets/messages-draft3/support-mascot.png')} alt="深度玩家吉祥物" width={72} height={72} />
      </div>
    </header>
    <section className="sell-v2-game-scroll" aria-label="选择回收游戏">
      <div className="sell-v2-search-layout" role="search"><SearchField value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} onClear={() => setDraftQuery('')} onSearch={() => setQuery(draftQuery.trim())} placeholder="搜索游戏名称" aria-label="搜索游戏名称" /></div>
      {!query && <><Heading as="h2" variant="section">最近看过</Heading><div className="sell-v2-game-grid recent">{recent.map((game) => <GameButton key={game.code} game={game} onChoose={choose} />)}</div></>}
      <div className="sell-v2-section-line"><Heading as="h2" variant="section">{query ? '搜索结果' : '热门回收'}</Heading></div>
      <div className="sell-v2-game-grid">{hot.map((game) => <GameButton key={game.code} game={game} onChoose={choose} />)}{!query && <button type="button" className="sell-v2-more-game dg-ui-focus" onClick={() => setRequestOpen(true)}><i><Plus size={20} /></i><b>更多游戏</b><small>申请接入</small></button>}</div>
      {query && !hot.length && <EmptyStateView compact title="没有找到这个游戏" description="换个关键词试试。" />}
    </section>
    <section className="sell-v2-quick-flow" aria-labelledby="recycle-flow-title">
      <Heading id="recycle-flow-title" as="h2" variant="section">快速回收流程</Heading>
      <ol>{[{ label: '提供信息', Icon: FileText }, { label: '价格沟通', Icon: MessagesSquare }, { label: '验号换绑', Icon: ShieldCheck }, { label: '签署合同', Icon: FileCheck2 }, { label: '极速到账', Icon: Zap }].map(({ label, Icon }, index) => <li key={label}><span className="sell-v2-quick-flow-icon"><Icon size={22} strokeWidth={1.8} aria-hidden="true" /></span><span>{label}</span>{index < 4 && <ArrowRight className="sell-v2-quick-flow-arrow" size={12} aria-hidden="true" />}</li>)}</ol>
    </section>
    {requestOpen && <GameAccessRequestDialog onClose={() => setRequestOpen(false)} onSubmit={request => { if (!sellRepository.requestGame(request)) return false; setRequestOpen(false); setToast('已记录你的游戏接入建议'); return true }} />}
    <footer className="sell-v2-note">咨询估价不等于成交，确认正式回收单前不会产生交易。</footer>
    <Toast message={toast} onDismiss={() => setToast('')} />
  </main>
}
export const SellEntryPage = SellPage

export function AppraisalPage() {
  const navigate = useNavigate(); const [params] = useSearchParams(); const chosen = (params.get('game') ?? sellRepository.getSelection().gameCode ?? 'wzry') as SellGameCode; const game = sellGames.find((item) => item.code === chosen) ?? sellGames[0]; const recyclers = availableRecyclers(recyclerFixtures, game.code); const [error, setError] = useState('')
  const consult = (recycler: Recycler) => { if (recycler.availability === 'offline') return; if (!sellRepository.selectGame(game.code) || !sellRepository.selectRecycler(recycler.id)) return setError('选择保存失败，请重试'); const order = recycleRepository.begin(recycler.id, game.code); if (!order) return setError('咨询创建失败，请重试'); navigate(`/appraisal/detail?id=${encodeURIComponent(order.id)}&role=seller`) }
  return <main className="sell-v2-page sell-v2-recyclers-page">
    <header className="sell-v2-studio-header sell-v2-recycle-hero">
      <StatusBar />
      <nav className="sell-v2-recycle-nav" aria-label="回收工作室导航"><IconButton label="返回" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/sell')}><ArrowLeft size={20} aria-hidden="true" /></IconButton></nav>
      <div className="sell-v2-studio-brand sell-v2-recycle-brand">
        <div className="sell-v2-studio-identity sell-v2-recycle-copy">
          <Heading as="h1" variant="hero">账号回收工作室</Heading>
          <Link className="sell-v2-studio-game-switch" to="/sell" aria-label={`切换回收游戏，当前${game.name}`}>
            {game.image && <img src={assetPath(game.image)} alt="" width={20} height={20} />}
            <span>{game.name}</span><small>切换</small><ArrowLeftRight size={12} aria-hidden="true" />
          </Link>
        </div>
        <img className="sell-v2-studio-mascot" src={assetPath('assets/messages-draft3/support-mascot.png')} alt="" width={72} height={72} />
      </div>
    </header>
    <p className="sell-v2-studio-count">{recyclers.length} 家回收商 · {recyclers.filter(item => item.availability === 'online').length} 家接单中</p>
    {error && <p className="sell-v2-inline-error" role="alert">{error}</p>}
    <section className="sell-v2-recycler-list" aria-label={`${game.name}回收商列表`}>{recyclers.map(recycler => <RecyclerCard key={recycler.id} recycler={recycler} onConsult={consult} />)}{!recyclers.length && <EmptyStateView title="暂无回收工作室" description="该游戏暂未有工作室入驻，可切换其他游戏看看。" action={<Button size="md" variant="outline" onClick={() => navigate('/sell')}>切换游戏</Button>} />}</section>
    <footer className="sell-v2-note" aria-label="交易风险提醒">提醒：私下交易有风险，钱号两空无保障，未成年人禁止售卖账号</footer>
  </main>
}

const emptyDraft: RecycleOrderDraft = { quoteCents: 0, server: '', rank: '', accountSummary: '' }
export function AppraisalDetailPage() {
  const navigate = useNavigate(); const [params, setParams] = useSearchParams(); const targetOrderId = params.get('id'); const rawRole = params.get('role'); const role: RecycleViewerRole = isRecycleViewerRole(rawRole) ? rawRole : 'seller'
  const [order, setOrder] = useState<RecycleOrder>(); const [text, setText] = useState(''); const [error, setError] = useState(''); const [toast, setToast] = useState(''); const [draftOpen, setDraftOpen] = useState(false); const [draft, setDraft] = useState(emptyDraft); const [draftErrors, setDraftErrors] = useState<Partial<Record<keyof RecycleOrderDraft, string>>>({}); const [paying, setPaying] = useState(false); const [roleMenu, setRoleMenu] = useState(false); const [now, setNow] = useState(Date.now())
  const sync = useCallback(() => setOrder(targetOrderId ? recycleRepository.get(targetOrderId) : recycleRepository.getActive()), [targetOrderId]); useEffect(() => { sync(); return recycleRepository.subscribe(sync) }, [sync]); useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, []); useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2000); return () => window.clearTimeout(timer) }, [toast])
  const switchRole = () => { const next = new URLSearchParams(params); next.set('role', role === 'seller' ? 'recycler' : 'seller'); next.delete('checkout'); setParams(next, { replace: true }) }
  useEffect(() => {
    if (order && getRecycleUnreadCount(order) > 0 && !recycleRepository.markRead(order.id)) setToast('未读状态保存失败，请稍后重试')
  }, [order?.id, order?.unreadCount])
  if (!order) return <main className="sell-v2-page"><BackTitle title="回收咨询" fallback="/sell" /><Empty title="还没有咨询" text="先选择游戏和回收商。" link="/sell" /></main>
  const send = () => { const issue = validateConsultationText(text); setError(issue); if (issue) return; if (!recycleRepository.sendMessage(order.id, text)) return setError('发送失败，请重试'); setText('') }
  const issueFormal = () => { const issues = validateRecycleOrderDraft(draft); setDraftErrors(issues); if (Object.keys(issues).length) return; if (!recycleRepository.createFormalOrder(order.id, draft)) return setToast('发送失败，请检查内容'); setDraftOpen(false); setToast('正式回收单已发送') }
  const pay = async () => { setPaying(true); const at = Date.now(); const thumbnail = sellGames.find((game) => game.code === order.gameCode)?.image ?? ''; if (!orderRepository.ensure(createRecyclePaidOrderRecord(order, at, thumbnail))) { setPaying(false); return setToast('订单创建失败，未完成付款') } const completed = recycleRepository.completePayment(order.id); if (!completed) { setPaying(false); return setToast('付款状态更新失败，可安全重试') } const conversation = createRecycleConversation(completed, at); const ok = conversation ? await messageRepository.ensureConversation(conversation) : false; setPaying(false); if (!ok) return setToast('已完成付款，交易群创建失败，可稍后重试'); const next = new URLSearchParams(params); next.delete('checkout'); setParams(next, { replace: true }); setToast('模拟付款完成，已创建交易群') }
  const enterGroup = async () => { const at = Date.now(); const thumbnail = sellGames.find((game) => game.code === order.gameCode)?.image ?? ''; if (!orderRepository.ensure(createRecyclePaidOrderRecord(order, at, thumbnail))) return setToast('交易订单创建失败，请重试'); const conversation = createRecycleConversation(order, at); if (!conversation) return setToast('交易群尚未生成'); if (!await messageRepository.ensureConversation(conversation)) return setToast('交易群创建失败，请重试'); navigate(`/im/${encodeURIComponent(conversation.id)}?orderId=${encodeURIComponent(conversation.orderId ?? '')}&role=seller`) }
  if (params.get('checkout') === '1' && role === 'recycler' && order.stage === 'submitted') return <Checkout order={order} paying={paying} onBack={() => { const next = new URLSearchParams(params); next.delete('checkout'); setParams(next, { replace: true }) }} onPay={() => void pay()} />
  return <main className="sell-v2-page sell-v2-chat-page"><header><ChatHeader order={order} role={role} menuOpen={roleMenu} onBack={() => navigate('/message?tab=recycle')} onRefresh={() => { sync(); setToast('已刷新') }} onToggleMenu={() => setRoleMenu((open) => !open)} onSwitchRole={() => { switchRole(); setRoleMenu(false) }} /></header><div className="sell-v2-safety"><ShieldCheck size={15} /><p>请勿发送密码、验证码、实名材料或站外联系方式</p></div><div className="sell-v2-chat-log" role="log" aria-label="回收咨询内容">{order.historyPreview ? <RecycleHistory order={order} onEnterGroup={() => void enterGroup()} /> : <>{order.messages.map((message) => <div className={`sell-v2-message ${message.sender}`} key={message.id}>{message.sender === 'recycler' && <i>{getRecycleConversationName(order).slice(0, 1)}</i>}<p>{message.content}</p></div>)}<FlowCard order={order} role={role} now={now} onDraft={() => { setDraft({ quoteCents: order.quoteCents || 2200, server: order.server === '默认区服' ? '' : order.server, rank: order.rank === '账号情况待沟通' ? '' : order.rank, accountSummary: '' }); setDraftOpen(true) }} onReject={() => recycleRepository.reject(order.id)} onConfirm={() => recycleRepository.confirmOrder(order.id)} onCheckout={() => { const next = new URLSearchParams(params); next.set('checkout', '1'); setParams(next) }} onEnterGroup={() => void enterGroup()} /></>}</div>{!['completed', 'rejected'].includes(order.stage) ? <footer className="sell-v2-composer"><input value={text} maxLength={500} placeholder="输入消息，@ 可提醒成员…" aria-invalid={Boolean(error)} onChange={(event) => { setText(event.target.value); setError('') }} onKeyDown={(event) => { if (event.key === 'Enter') send() }} /><button type="button" onClick={send}>{text.trim() ? '发送' : <Plus size={20} />}</button>{error && <small role="alert">{error}</small>}</footer> : <footer className="sell-v2-readonly">咨询已结束，记录仅供查看</footer>}{draftOpen && <DraftSheet draft={draft} errors={draftErrors} onChange={setDraft} onClose={() => setDraftOpen(false)} onSubmit={issueFormal} />}{toast && <div className="sell-v2-toast" role="status">{toast}</div>}</main>
}

function ChatHeader({ order, role, menuOpen, onBack, onRefresh, onToggleMenu, onSwitchRole }: { order: RecycleOrder; role: RecycleViewerRole; menuOpen: boolean; onBack: () => void; onRefresh: () => void; onToggleMenu: () => void; onSwitchRole: () => void }) {
  const game = sellGames.find((item) => item.code === order.gameCode)
  return <><StatusBar /><div className="sell-v2-chat-header"><button type="button" aria-label="返回" onClick={onBack}><ArrowLeft size={20} /></button><i style={{ background: game?.color }}>{game?.image ? <img src={assetPath(game.image)} alt="" /> : order.gameName.slice(0, 1)}</i><span><Heading as="h1" variant="page">{order.gameName} · 回收咨询</Heading><small>{getRecycleConversationName(order)}<b />{getRecycleStatusLabel(order, role)}</small></span><button type="button" aria-label="刷新咨询" onClick={onRefresh}><RefreshCw size={18} /></button><button type="button" aria-label="更多" aria-expanded={menuOpen} onClick={onToggleMenu}><MoreVertical size={18} /></button>{menuOpen && <div className="sell-v2-more-menu"><small>角色预览</small><button type="button" onClick={onSwitchRole}>切换为{role === 'seller' ? '回收商' : '卖家'}视角</button></div>}</div></>
}

function FlowCard({ order, role, now, onDraft, onReject, onConfirm, onCheckout, onEnterGroup }: { order: RecycleOrder; role: RecycleViewerRole; now: number; onDraft: () => void; onReject: () => void; onConfirm: () => void; onCheckout: () => void; onEnterGroup: () => void }) {
  if (order.stage === 'consulting') return <section className="sell-v2-flow-card empty"><span>回收单</span><Heading as="h2" variant="section">尚未发送回收单</Heading><p>{role === 'recycler' ? '确认账号概况与报价后，向卖家发送正式回收单。' : '继续沟通账号概况，等待回收商发送正式回收单。'}</p>{role === 'recycler' && <button type="button" onClick={onDraft}>发送回收单</button>}</section>
  if (order.stage === 'formal') return <><section className="sell-v2-order-card"><header><b><i />回收单 · {role === 'seller' ? '待你确认' : '等待卖家确认'}</b><small>剩 {formatRecycleCountdown(order.expiresAt, now)}</small></header><div className="sell-v2-order-price"><strong><small>¥</small>{(order.quoteCents / 100).toFixed(2)}</strong><span>预计到手<b>¥{(order.quoteCents / 100).toFixed(2)}</b></span></div><dl><div><dt>登录账号</dt><dd>22</dd></div><div><dt>实名 / 贵族 / 防沉迷</dt><dd>包人脸 · V · 有防沉迷</dd></div><div><dt>回收单号</dt><dd>{shortId(order.id)}</dd></div></dl>{role === 'seller' ? <><aside><b>确认注意</b><p>确认后进入交易，回收商需在时限内完成付款。确认前请核对账号信息与报价，<strong>此后不能再以报价过低为由退单。</strong></p></aside><footer><button type="button" onClick={onReject}>拒绝</button><button type="button" onClick={onConfirm}>确认回收单</button></footer></> : <button type="button" className="sell-v2-order-disabled" disabled>等待卖家确认</button>}</section>{role === 'seller' && <SupportNote>确认只表示接受报价，回收商付款后才算成交。</SupportNote>}</>
  if (order.stage === 'submitted' && role === 'seller') return <><section className="sell-v2-order-card"><header><b><i />回收单 · 待回收商付款</b><em>已确认</em></header><div className="sell-v2-order-price"><strong><small>¥</small>{(order.quoteCents / 100).toFixed(2)}</strong><span>预计到账<b>¥{(order.quoteCents / 100).toFixed(2)}</b></span></div><dl><div><dt>回收商</dt><dd>{order.recyclerName}</dd></div><div><dt>回收单号</dt><dd>{shortId(order.id)}</dd></div></dl><p className="sell-v2-order-explain">等待回收商完成付款。付款成功后回收单成交，并自动建立交易群。</p><button type="button" className="sell-v2-order-disabled" disabled>等待回收商付款</button></section><SupportNote>我马上去付款，稍等两分钟。</SupportNote></>
  if (order.stage === 'submitted') { const total = getRecyclePayableCents(order); const fee = total - order.quoteCents; return <section className="sell-v2-order-card"><header><b><i />回收单 · 待你付款</b><small>剩 {formatRecycleCountdown(order.expiresAt, now)}</small></header><div className="sell-v2-order-price"><strong><small>¥</small>{(total / 100).toFixed(2)}</strong><span>实际应付<b className="sell-v2-payable-amount">¥{(total / 100).toFixed(2)}</b></span></div><dl><div><dt>回收价</dt><dd>¥{(order.quoteCents / 100).toFixed(2)}</dd></div><div><dt>包赔费（10%）</dt><dd>¥{(fee / 100).toFixed(2)}</dd></div><div><dt>回收单号</dt><dd>{shortId(order.id)}</dd></div></dl><aside><b>付款注意</b><p>卖家已确认回收单，请在时限内完成付款。<strong>超时未付回收单将自动关闭。</strong></p></aside><div className="sell-v2-order-success"><ShieldCheck size={14} />付款成功后回收单成交，并自动建立交易群</div><button type="button" className="sell-v2-order-pay" onClick={onCheckout}>去付款 ¥{(total / 100).toFixed(2)}</button></section> }
  if (order.stage === 'completed') return <section className="sell-v2-flow-card completed"><i><Check size={28} /></i><Heading as="h2" variant="result">已成交</Heading><strong>¥{(order.quoteCents / 100).toFixed(2)}</strong><p>本地演示状态：付款步骤已完成。后续四步履约请在交易群内进行。</p><button type="button" onClick={onEnterGroup}>进入交易群 <ChevronRight size={16} /></button></section>
  return <section className="sell-v2-flow-card empty"><Heading as="h2" variant="section">{order.stage === 'rejected' ? '本次咨询已结束' : '历史回收流程'}</Heading><p>{order.stage === 'rejected' ? '未产生付款或交易。' : '请在消息的回收群中查看咨询记录。'}</p></section>
}

function shortId(id: string) { return id.length > 8 ? `${id.slice(0, 2)}…${id.slice(-5)}` : id }
function SupportNote({ children }: { children: string }) { return <div className="sell-v2-support-note"><i>萌</i><span><small>萌萌　平台客服</small><p>{children}</p></span></div> }

function DraftSheet({ draft, errors, onChange, onClose, onSubmit }: { draft: RecycleOrderDraft; errors: Partial<Record<keyof RecycleOrderDraft, string>>; onChange: (draft: RecycleOrderDraft) => void; onClose: () => void; onSubmit: () => void }) { return <div className="sell-v2-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="sell-v2-sheet" role="dialog" aria-modal="true" aria-labelledby="draft-title"><header><Heading as="h2" variant="section" id="draft-title">发送回收单</Heading><button type="button" onClick={onClose}><X size={20} /></button></header><p>仅填写报价与账号概况，不要填写密码、手机号或实名信息。</p><div className="sell-v2-draft-fields"><TextField label="回收价（元）" inputMode="decimal" value={draft.quoteCents ? draft.quoteCents / 100 : ''} onChange={(event) => onChange({ ...draft, quoteCents: Math.round(Number(event.target.value) * 100) })} error={errors.quoteCents} /><TextField label="游戏区服" value={draft.server} maxLength={24} onChange={(event) => onChange({ ...draft, server: event.target.value })} placeholder="例如：QQ区" error={errors.server} /><TextField label="段位 / 账号概况" value={draft.rank} maxLength={40} onChange={(event) => onChange({ ...draft, rank: event.target.value })} placeholder="例如：高段位 · 皮肤较多" error={errors.rank} /><TextAreaField label="报价依据" value={draft.accountSummary} maxLength={80} showCount onChange={(event) => onChange({ ...draft, accountSummary: event.target.value })} placeholder="简要说明报价依据" error={errors.accountSummary} /></div><Button className="sell-v2-primary" fullWidth onClick={onSubmit}>确认发送</Button></section></div> }

function Checkout({ order, paying, onBack, onPay }: { order: RecycleOrder; paying: boolean; onBack: () => void; onPay: () => void }) { const total = getRecyclePayableCents(order); const fee = total - order.quoteCents; return <main className="sell-v2-page sell-v2-checkout"><header><StatusBar className="sell-v2-status" /><div className="sell-v2-checkout-title"><button type="button" onClick={onBack}><ArrowLeft size={20} /></button><Heading as="h1" variant="page">确认支付</Heading><small>剩余 {formatRecycleCountdown(order.expiresAt, Date.now())}</small></div></header><section className="sell-v2-pay-total"><small>回收订单支付</small><strong>¥{(total / 100).toFixed(2)}</strong><p>{order.id}</p></section><section className="sell-v2-pay-detail"><p><span>回收价</span><b>¥{(order.quoteCents / 100).toFixed(2)}</b></p><p><span>包赔费（10%）</span><b>¥{(fee / 100).toFixed(2)}</b></p><p className="total"><span>应付</span><b>¥{(total / 100).toFixed(2)}</b></p></section><Heading as="h2" variant="section" className="sell-v2-pay-heading">支付方式</Heading><section className="sell-v2-pay-method"><label><span className="alipay">支</span><b>支付宝</b><input type="radio" checked readOnly /></label><label><span className="wechat">微</span><b>微信</b><input type="radio" readOnly /></label></section><aside>点击确认支付后将锁定订单并发起支付。当前为本地演示，不会发生真实扣款；完成后请返回订单查看后续履约状态。</aside><footer><Button variant="outline" onClick={onBack}>返回</Button><Button loading={paying} onClick={onPay}>确认支付 ¥{(total / 100).toFixed(2)}</Button></footer></main> }
function Empty({ title, text, link }: { title: string; text: string; link?: string }) { return <div className="sell-v2-empty"><Heading as="h2" variant="section">{title}</Heading><p>{text}</p>{link && <Link to={link}>去看看</Link>}</div> }

export function AppraisalFillPage() { const [params] = useSearchParams(); return <Navigate to={`/appraisal/detail?${params.toString()}`} replace /> }
export function AppraisalLoadingPage() { const [params] = useSearchParams(); return <Navigate to={`/appraisal/detail?${params.toString()}`} replace /> }
export function SellGoodsPage() { return <Navigate to="/message?tab=recycle" replace /> }
