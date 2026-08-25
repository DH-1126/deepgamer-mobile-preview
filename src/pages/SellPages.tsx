import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Image as ImageIcon, MoreVertical, Plus, Search, ShieldCheck, Upload, X } from 'lucide-react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { availableRecyclers, filterSellGames, formatRecycleCountdown, incompleteMaterials, validateConsultationText, validateRecycleForm } from '../components/sellModel'
import { assetPath } from '../components/assetPath'
import { recyclerFixtures, sellGames } from '../data/sellFixtures'
import { recycleRepository } from '../repository/recycleRepository'
import { sellRepository } from '../repository/sellRepository'
import type { RecycleFormInput, RecycleOrder } from '../types/recycle'
import type { Recycler, SellGame, SellGameCode } from '../types/sell'
import '../styles/sell-v2.css'

function StatusBar() {
  return <div className="sell-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
}

function BackTitle({ title, subtitle, fallback = '/profile', menu = false }: { title: string; subtitle?: string; fallback?: string; menu?: boolean }) {
  const navigate = useNavigate()
  return <><StatusBar /><div className="sell-v2-titlebar"><button type="button" aria-label="返回" onClick={() => window.history.length > 1 ? navigate(-1) : navigate(fallback)}><ArrowLeft size={20} aria-hidden="true" /></button><span><h1>{title}</h1>{subtitle && <small>{subtitle}</small>}</span>{menu ? <button type="button" aria-label="更多操作"><MoreVertical size={20} aria-hidden="true" /></button> : <i />}</div></>
}

export function SellPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const recent = sellGames.filter((game) => game.featured)
  const hot = filterSellGames(query ? sellGames : sellGames.filter((game) => !game.featured), query)
  const choose = (game: SellGame) => {
    if (!game.consultationCount) { setToast('该游戏暂无回收商，可先选择其他游戏'); return }
    if (!sellRepository.selectGame(game.code)) { setToast('选择保存失败，请重试'); return }
    navigate(`/appraisal?game=${game.code}`)
  }
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 1800); return () => window.clearTimeout(timer) }, [toast])
  return <main className="sell-v2-page sell-v2-games-page">
    <header><BackTitle title="账号回收" /><div className="sell-v2-intro"><h2>选择要卖的游戏</h2><p>选择后查看可咨询的回收商</p></div><label className="sell-v2-search"><Search size={17} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索游戏名称" aria-label="搜索游戏名称" /><span>{query && <button type="button" onClick={() => setQuery('')} aria-label="清空搜索"><X size={14} /></button>}</span></label></header>
    <section className="sell-v2-game-scroll" aria-label="可回收游戏">
      {!query && <><h3>你最近看过</h3><div className="sell-v2-game-grid recent">{recent.map((game) => <GameButton key={game.code} game={game} onChoose={choose} />)}</div></>}
      <div className="sell-v2-section-line"><h3>{query ? '搜索结果' : '热门回收'}</h3>{!query && <small>回收商多、报价快</small>}</div>
      <div className="sell-v2-game-grid">{hot.map((game) => <GameButton key={game.code} game={game} onChoose={choose} />)}{!query && <button type="button" className="sell-v2-more-game" onClick={() => setToast('更多游戏正在接入')}><i><Plus size={20} /></i><b>更多游戏</b><small>共 48 个</small></button>}</div>
      {query && hot.length === 0 && <div className="sell-v2-empty"><h2>没有找到这个游戏</h2><p>换个关键词，或等待更多游戏接入。</p></div>}
    </section>
    <footer className="sell-v2-note">回收是把账号直接卖给平台回收商。想挂牌等买家出价，可以回到「卖号」发布商品。</footer>
    {toast && <div className="sell-v2-toast" role="status">{toast}</div>}
  </main>
}

export const SellEntryPage = SellPage

function GameButton({ game, onChoose }: { game: SellGame; onChoose: (game: SellGame) => void }) {
  return <button type="button" className={game.consultationCount ? '' : 'unavailable'} onClick={() => onChoose(game)} aria-label={`${game.name}，${game.consultationCount ? `${game.consultationCount}家可咨询` : '暂无回收商'}`}><i style={{ background: game.color }}>{game.mark}</i><b>{game.name}</b><small>{game.consultationCount ? <><em>{game.consultationCount}</em> 家可咨询</> : '暂无回收商'}</small></button>
}

export function AppraisalPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const chosen = (params.get('game') ?? sellRepository.getSelection().gameCode ?? 'wzry') as SellGameCode
  const game = sellGames.find((item) => item.code === chosen) ?? sellGames[0]
  const recyclers = availableRecyclers(recyclerFixtures, game.code)
  const [error, setError] = useState('')
  const consult = (recycler: Recycler) => {
    if (recycler.availability === 'offline') return
    if (!sellRepository.selectGame(game.code) || !sellRepository.selectRecycler(recycler.id)) { setError('选择保存失败，请重试'); return }
    const order = recycleRepository.begin(recycler.id)
    if (!order) { setError('咨询创建失败，请重试'); return }
    navigate('/appraisal/detail')
  }
  return <main className="sell-v2-page sell-v2-recyclers-page"><header><BackTitle title={`${game.name}回收商`} fallback="/sell" /><div className="sell-v2-selected-game"><i style={{ background: game.color }}>{game.mark}</i><span><b>{game.name}</b><small>{recyclers.length} 家回收商可咨询</small></span></div></header>
    <section className="sell-v2-warning"><ShieldCheck size={16} aria-hidden="true" /><span><b>咨询估价不等于成交</b><small>收到正式报价后再决定卖不卖，确认前不产生交易。</small></span></section>
    {error && <p className="sell-v2-inline-error" role="alert">{error}</p>}
    <section className="sell-v2-recycler-list" aria-label={`${game.name}回收商列表`}>{recyclers.length ? recyclers.map((recycler) => <article key={recycler.id} className={recycler.availability === 'offline' ? 'offline' : ''}><header><i>{recycler.mark}</i><span><h2>{recycler.name} <small>· {recycler.availability === 'online' ? '接单中' : '非服务时间'}</small></h2><p>{recycler.averageResponseMinutes ? `平均响应 ${recycler.averageResponseMinutes} 分钟 · ` : '服务时间 '}{recycler.serviceTime}</p></span><button type="button" disabled={recycler.availability === 'offline'} onClick={() => consult(recycler)}>{recycler.availability === 'online' ? '咨询估价' : '暂不可咨询'}</button></header><p>{recycler.description}</p><footer>{recycler.tags.map((tag) => <span key={tag}>{tag}</span>)}</footer></article>) : <div className="sell-v2-empty"><h2>暂无可咨询回收商</h2><p>该游戏的回收服务正在接入。</p><Link to="/sell">选择其他游戏</Link></div>}</section>
    <p className="sell-v2-list-hint">向下继续查看其余回收商</p>
  </main>
}

export function AppraisalDetailPage() {
  const navigate = useNavigate()
  const [order, setOrder] = useState<RecycleOrder>()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [now, setNow] = useState(Date.now())
  const fileRef = useRef<HTMLInputElement>(null)
  const sync = useCallback(() => setOrder(recycleRepository.getActive()), [])
  useEffect(() => { sync(); return recycleRepository.subscribe(sync) }, [sync])
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 1800); return () => window.clearTimeout(timer) }, [toast])
  if (!order) return <main className="sell-v2-page"><BackTitle title="回收咨询" fallback="/sell" /><div className="sell-v2-empty"><h2>还没有进行中的咨询</h2><p>先选择游戏和回收商，再开始估价。</p><Link to="/sell">选择游戏</Link></div></main>
  if (['submitted', 'inspecting', 'completed'].includes(order.stage)) return <Navigate to={order.stage === 'submitted' && !order.submission ? '/appraisal/fill' : '/appraisal/loading'} replace />
  const send = () => {
    const issue = validateConsultationText(text); setError(issue); if (issue) return
    if (!recycleRepository.sendMessage(order.id, text)) { setError('发送失败，请重试'); return }
    setText(''); setToast('已发送')
  }
  const materialCount = incompleteMaterials(order.materials)
  const updateMaterial = (key: 'battle_screenshot' | 'platform_binding', value: string) => { if (!recycleRepository.setMaterial(order.id, key, value)) setToast('保存失败，请重试') }
  const createFormal = () => { if (!recycleRepository.createFormalOrder(order.id)) { setToast(materialCount ? `还有 ${materialCount} 项未完成` : '创建回收单失败'); return } }
  const reject = () => { if (recycleRepository.reject(order.id)) setToast('已结束本次回收咨询') }
  const confirm = () => { if (!recycleRepository.confirmOrder(order.id)) { setToast('确认失败，请重试'); return } navigate('/appraisal/fill') }
  return <main className="sell-v2-page sell-v2-chat-page">
    <header><BackTitle title={`${order.gameName} · 回收咨询`} subtitle={`${order.recyclerName} · ${order.stage === 'formal' ? '待你确认回收单' : order.stage === 'offered' ? '待你决定' : order.stage === 'materials' ? '报价已接受' : '接单中'}`} fallback="/appraisal" menu /></header>
    <div className="sell-v2-chat-log" role="log" aria-live="polite">
      {order.stage === 'consulting' && <section className="sell-v2-safety"><ShieldCheck size={15} /><p>不要发送密码、验证码、实名材料和站外联系方式。所有交易在平台内完成。</p></section>}
      {order.stage === 'consulting' && <time className="sell-v2-chat-stage">咨询阶段 · 尚未成交</time>}
      {order.messages.map((message) => message.sender === 'system' ? <p className="sell-v2-chat-stage" key={message.id}>{message.content}</p> : <div className={`sell-v2-message ${message.sender}`} key={message.id}>{message.sender === 'recycler' && <i>趣</i>}<p>{message.content}</p></div>)}
      {order.stage === 'consulting' && <button type="button" className="sell-v2-demo-offer" onClick={() => recycleRepository.receiveOffer(order.id)}>资料已发，查看模拟报价</button>}
      {order.stage === 'offered' && <><div className="sell-v2-message recycler"><i>趣</i><p>看完了。星耀 2、86 皮肤、可二次实名，按这个情况给你出价。</p></div><p className="sell-v2-chat-stage">回收商已发送正式报价</p><QuoteCard order={order} now={now} formal={false} onSecondary={() => setToast('可以继续在下方沟通价格')} onPrimary={() => recycleRepository.acceptOffer(order.id)} /></>}
      {order.stage === 'materials' && <><div className="sell-v2-message user"><p>可以，我接受 <b>¥{order.quoteCents / 100}</b></p></div><p className="sell-v2-chat-stage">你已接受 ¥{order.quoteCents / 100} 报价</p><div className="sell-v2-message recycler"><i>趣</i><p>好的。发回收单前还需要两样东西核对一下账号。</p></div><section className="sell-v2-material-card"><header><h2>补充估价资料</h2><b>¥{order.quoteCents / 100}</b><p>用于核对账号情况，不会提交密码、验证码或实名信息。</p></header>{order.materials.map((item) => <div className="sell-v2-material" key={item.key}><i className={item.completed ? 'done' : ''}>{item.completed && <Check size={13} />}</i><span><b>{item.label}</b><small>{item.value || item.detail}</small></span>{item.key === 'battle_screenshot' && <button type="button" onClick={() => fileRef.current?.click()}>{item.completed ? '已上传' : '上传'}</button>}{item.key === 'platform_binding' && <span className="sell-v2-material-options"><button type="button" className={item.value === '没有' ? 'active' : ''} onClick={() => updateMaterial('platform_binding', '没有')}>没有</button><button type="button" className={item.value === '有，说明一下' ? 'active' : ''} onClick={() => updateMaterial('platform_binding', '有，说明一下')}>有，说明一下</button></span>}</div>)}<input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => { if (event.target.files?.[0]) updateMaterial('battle_screenshot', '已上传 1 张') }} /><button className="sell-v2-material-submit" type="button" disabled={materialCount > 0} onClick={createFormal}>{materialCount ? `还有 ${materialCount} 项未完成` : '生成正式回收单'}</button></section><p className="sell-v2-material-help">补充完成后回收商会发送正式回收单。此时仍未成交，你可以随时停止。</p></>}
      {order.stage === 'formal' && <><div className="sell-v2-message recycler"><i>趣</i><p>资料收到了，回收单发你了，确认一下就能进入正式交易。</p></div><p className="sell-v2-chat-stage">报价已转为正式回收单</p><QuoteCard order={order} now={now} formal onSecondary={reject} onPrimary={confirm} /><p className="sell-v2-material-help">确认后本次交易正式开始，回收价不再变动。有效期内未确认，回收单会自动失效。</p></>}
      {order.stage === 'rejected' && <div className="sell-v2-empty"><h2>本次咨询已结束</h2><p>没有提交账号资料，也不会产生交易。</p><Link to="/sell">重新估价</Link></div>}
    </div>
    {!['rejected'].includes(order.stage) && <footer className="sell-v2-composer"><ImageIcon size={19} aria-hidden="true" /><input value={text} maxLength={500} placeholder={order.stage === 'offered' ? '对价格有疑问可以直接问…' : '说说账号情况…'} aria-label="咨询内容" aria-invalid={Boolean(error)} onChange={(event) => { setText(event.target.value); setError('') }} onKeyDown={(event) => { if (event.key === 'Enter') send() }} /><button type="button" onClick={send} aria-label="发送">{text.trim() ? '发送' : <Plus size={20} />}</button>{error && <small role="alert">{error}</small>}</footer>}
    {toast && <div className="sell-v2-toast" role="status">{toast}</div>}
  </main>
}

function QuoteCard({ order, now, formal, onSecondary, onPrimary }: { order: RecycleOrder; now: number; formal: boolean; onSecondary: () => void; onPrimary: () => void }) {
  return <section className="sell-v2-quote"><header><b>{formal ? '✓ 正式回收单' : '• 回收报价'}</b><small>{formal ? `#${order.id}` : `剩 ${formatRecycleCountdown(order.expiresAt, now)}`}</small></header><div className="sell-v2-quote-price"><strong><small>¥</small>{order.quoteCents / 100}</strong><span>预计到手<b>¥{order.quoteCents / 100}</b></span></div><dl><div><dt>账号</dt><dd>{order.gameName} {order.server} {order.rank}</dd></div><div><dt>回收商</dt><dd>{order.recyclerName}</dd></div><div><dt>手续费</dt><dd>回收商承担</dd></div>{formal && <div><dt>回收单有效期</dt><dd className="accent">{formatRecycleCountdown(order.expiresAt, now)}</dd></div>}</dl><p>{formal ? '确认后需要填写回收资料，平台验号通过并完成换绑后打款到你的余额。资金由平台托管。' : '接受报价不代表卖号完成。回收商会据此发送正式回收单，你确认后才进入交易。'}</p><footer><button type="button" onClick={onSecondary}>{formal ? '先不卖' : '再聊聊'}</button><button type="button" onClick={onPrimary}>{formal ? '确认报价，填回收资料' : '接受这个报价'}</button></footer></section>
}

const emptyForm: RecycleFormInput = { loginAccount: '', campId: '88412903', canRealname: null, screenshotCount: 0, note: '', acceptedRules: false }

export function AppraisalFillPage() {
  const navigate = useNavigate()
  const [order] = useState(() => recycleRepository.getActive())
  const [form, setForm] = useState<RecycleFormInput>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof RecycleFormInput, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  if (!order) return <main className="sell-v2-page"><BackTitle title="填写回收资料" fallback="/sell" /><div className="sell-v2-empty"><h2>回收单不存在</h2><Link to="/sell">重新估价</Link></div></main>
  const submit = () => {
    const nextErrors = validateRecycleForm(form); setErrors(nextErrors); if (Object.keys(nextErrors).length) return
    setSubmitting(true)
    const ok = recycleRepository.submit(order.id, form)
    setSubmitting(false)
    if (!ok) { setErrors({ loginAccount: '提交失败，请检查回收单状态后重试' }); return }
    setForm((current) => ({ ...current, loginAccount: '' }))
    navigate('/appraisal/loading')
  }
  return <main className="sell-v2-page sell-v2-fill-page"><header><BackTitle title="填写回收资料" fallback="/appraisal/detail" /></header><QuoteSummary order={order} />
    <form onSubmit={(event) => { event.preventDefault(); submit() }} noValidate><h2>账号资料</h2><section>
      <label><span>登录账号 <b>*</b></span><input inputMode="numeric" autoComplete="off" value={form.loginAccount} onChange={(event) => setForm({ ...form, loginAccount: event.target.value.replace(/\D/g, '').slice(0, 12) })} placeholder="请输入用于登录的 QQ 号" aria-invalid={Boolean(errors.loginAccount)} />{errors.loginAccount && <small role="alert">{errors.loginAccount}</small>}<em>本地演示仅保存脱敏结果，请勿输入密码或验证码</em></label>
      <label><span>营地 ID <b>*</b></span><input inputMode="numeric" value={form.campId} onChange={(event) => setForm({ ...form, campId: event.target.value.replace(/\D/g, '').slice(0, 12) })} aria-invalid={Boolean(errors.campId)} />{errors.campId && <small role="alert">{errors.campId}</small>}</label>
      <fieldset><legend>是否能二次实名 <b>*</b></legend><div><button type="button" className={form.canRealname === true ? 'active' : ''} onClick={() => setForm({ ...form, canRealname: true })}>可以</button><button type="button" className={form.canRealname === false ? 'active' : ''} onClick={() => setForm({ ...form, canRealname: false })}>不可以</button></div>{errors.canRealname && <small role="alert">{errors.canRealname}</small>}</fieldset>
      <fieldset><legend>账号截图 <small>{form.screenshotCount}/6</small></legend><div className="sell-v2-upload"><button type="button" onClick={() => fileRef.current?.click()}><Upload size={18} /><span>添加</span></button>{form.screenshotCount > 0 && <i><ImageIcon size={22} /><button type="button" onClick={() => setForm({ ...form, screenshotCount: 0 })} aria-label="移除截图"><X size={12} /></button></i>}</div><input ref={fileRef} hidden type="file" multiple accept="image/*" onChange={(event) => setForm({ ...form, screenshotCount: Math.min(6, event.target.files?.length ?? 0) })} /><p>建议上传皮肤页、战绩页和英雄列表。请勿包含密码、验证码或身份证信息。</p>{errors.screenshotCount && <small role="alert">{errors.screenshotCount}</small>}</fieldset>
      <label><span>补充说明</span><textarea maxLength={200} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="选填，例如账号的特殊情况" />{errors.note && <small role="alert">{errors.note}</small>}</label>
      <label className="sell-v2-rules"><input type="checkbox" checked={form.acceptedRules} onChange={(event) => setForm({ ...form, acceptedRules: event.target.checked })} /><i>{form.acceptedRules && <Check size={12} />}</i><span>我确认账号为本人所有、无封禁与纠纷，并已阅读《账号回收规则》</span></label>{errors.acceptedRules && <small role="alert">{errors.acceptedRules}</small>}
    </section><footer><button type="button" onClick={() => navigate('/appraisal/detail')}>取消</button><button type="submit" disabled={submitting}><b>{submitting ? '提交中…' : '提交回收单'}</b><small>提交后进入平台验号</small></button></footer></form>
  </main>
}

function QuoteSummary({ order }: { order: RecycleOrder }) {
  return <section className="sell-v2-summary"><header><b>✓ 回收单已确认</b><small>#{order.id}</small></header><div><strong><small>¥</small>{order.quoteCents / 100}</strong><span>预计到手<b>¥{order.quoteCents / 100}</b></span></div><footer>{order.gameName} {order.server} · {order.recyclerName}</footer></section>
}

export function AppraisalLoadingPage() {
  const [order, setOrder] = useState(() => recycleRepository.getActive())
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const sync = useCallback(() => setOrder(recycleRepository.getActive()), [])
  useEffect(() => recycleRepository.subscribe(sync), [sync])
  if (!order) return <main className="sell-v2-page"><BackTitle title="平台验号" fallback="/sell" /><div className="sell-v2-empty"><h2>未找到回收单</h2><Link to="/sell">重新估价</Link></div></main>
  const run = async () => {
    setWorking(true); setError('')
    await new Promise((resolve) => window.setTimeout(resolve, 450))
    const ok = order.stage === 'submitted' ? recycleRepository.startInspection(order.id) : order.stage === 'inspecting' ? recycleRepository.complete(order.id) : false
    setWorking(false); if (!ok) setError('状态更新失败，请重试')
  }
  return <main className="sell-v2-page sell-v2-loading-page"><header><BackTitle title="平台验号" fallback="/sell/goods" /></header><QuoteSummary order={order} /><section className={`sell-v2-progress-state ${order.stage}`}><i>{order.stage === 'completed' ? <Check size={40} /> : <span />}</i><h2>{order.stage === 'completed' ? '回收完成' : order.stage === 'inspecting' ? '平台正在验号' : '资料提交成功'}</h2><p>{order.stage === 'completed' ? '本地演示已完成，回收款将进入余额。' : order.stage === 'inspecting' ? '正在核对账号资料与回收单，演示不会连接真实账号。' : '回收资料已安全提交，本地只保存了脱敏账号。'}</p><ol><li className="done">提交回收资料</li><li className={order.stage === 'inspecting' || order.stage === 'completed' ? 'done' : ''}>平台验号</li><li className={order.stage === 'completed' ? 'done' : ''}>完成回收</li></ol>{error && <small role="alert">{error}</small>}{order.stage === 'completed' ? <Link to="/sell/goods">查看我的回收单</Link> : <button type="button" disabled={working} onClick={() => void run()}>{working ? '处理中…' : error ? '重试' : order.stage === 'inspecting' ? '完成本地演示' : '开始本地验号'}</button>}</section></main>
}

export function SellGoodsPage() {
  const [orders, setOrders] = useState(() => recycleRepository.list())
  useEffect(() => recycleRepository.subscribe(() => setOrders(recycleRepository.list())), [])
  const status = (stage: RecycleOrder['stage']) => ({ consulting: '咨询中', offered: '待决定', materials: '待补资料', formal: '待确认', submitted: '待验号', inspecting: '验号中', completed: '已完成', rejected: '已结束' }[stage])
  return <main className="sell-v2-page sell-v2-goods-page"><header><BackTitle title="我的回收单" fallback="/profile" /></header><section>{orders.length ? orders.map((order) => <Link key={order.id} to={['submitted', 'inspecting', 'completed'].includes(order.stage) ? '/appraisal/loading' : '/appraisal/detail'}><header><time>{new Date(order.updatedAt).toLocaleDateString('zh-CN')}</time><b className={`stage-${order.stage}`}>{status(order.stage)}</b></header><div><i>{order.gameName.slice(0, 1)}</i><span><h2>{order.gameName} {order.server} · {order.rank}</h2><p>回收商：{order.recyclerName}</p><small>#{order.id}</small></span><strong>¥{order.quoteCents / 100}</strong></div></Link>) : <div className="sell-v2-empty"><h2>还没有回收单</h2><p>选择游戏和回收商，先咨询估价。</p><Link to="/sell">开始回收</Link></div>}</section></main>
}
