import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ChevronRight, CirclePlus, MessageSquareText, MoreHorizontal, ShoppingBag, Star, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { DesignPromptTrigger } from '../components/DesignPromptTrigger'
import { createPendingMessage, validateMessageText } from '../components/messageModel'
import { BottomSheet, Button, Cell, Heading, SearchField, Toast, ToggleSwitch } from '../components/ui'
import { homeGames, recentGames, type HomeGame } from '../data/homeData'
import { messageRepository } from '../repository/messageRepository'
import { productDetailRepository } from '../repository/productDetailRepository'
import { products } from '../data/fixtures'
import type { Conversation, ConversationMessage } from '../types/message'
import type { Product } from '../types/catalog'
import type { ProductDetail } from '../types/productDetail'
import '../styles/support-chat-draft3.css'

type Props = { conversation: Conversation; messages: ConversationMessage[] }

const faq = ['这个号支持二次实名吗', '换绑一般要多久', '被找回怎么赔付']
const allGames: HomeGame[] = [
  ...homeGames.filter((game, index, list) => list.findIndex((item) => item.code === game.code) === index),
  { name: '暗区突围', code: 'aqtw', image: '' },
  { name: '奥奇传说手游', code: 'aqcssy', image: '' },
  { name: 'Apex 英雄', code: 'apex', image: '' },
]

function SupportStatusBar({ yellow = false, nodeId }: { yellow?: boolean; nodeId: string }) { return <DesignPromptTrigger nodeId={nodeId} tone={yellow ? 'inverse' : 'default'} className={`support-d3-status${yellow ? ' yellow' : ''}`} /> }

export function SupportChatPage({ conversation, messages }: Props) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const params = new URLSearchParams(search)
  const scenario = params.get('scenario')
  const consultationProduct = scenario === 'product' ? productDetailRepository.getById(params.get('productId') ?? '') : undefined
  const game = allGames.find(item => item.code === (consultationProduct?.gameCode ?? params.get('gameCode'))) ?? homeGames[0]
  if (scenario === 'select') return <SupportGameSelect onBack={() => navigate(-1)} onSelect={(next) => {
    const nextParams = new URLSearchParams(search)
    nextParams.set('scenario', 'chat')
    nextParams.set('gameCode', next.code)
    navigate(`${pathname}?${nextParams}`)
  }} />
  return <SupportConversation conversation={conversation} messages={messages} game={game} scenario={scenario} consultationProduct={consultationProduct} initialSettings={scenario === 'settings'} onBack={() => navigate(-1)} />
}

function SupportGameSelect({ onBack, onSelect }: { onBack: () => void; onSelect: (game: HomeGame) => void }) {
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => allGames.filter((game) => game.name.toLocaleLowerCase('zh-CN').includes(query.trim().toLocaleLowerCase('zh-CN'))), [query])
  return <main className="support-d3-page support-d3-select" data-node-id="3681:27399">
    <header className="support-d3-select-hero">
      <SupportStatusBar yellow nodeId="3681:27399" />
      <button type="button" onClick={onBack} aria-label="返回"><ArrowLeft size={21} /></button>
      <div className="support-d3-select-intro">
        <div><Heading as="h1" variant="hero">专属客服在线咨询</Heading><p>选择游戏，开启 <b>1v1</b> 服务</p></div>
        <img className="support-d3-mascot" src={assetPath('assets/messages-draft3/support-mascot.png')} alt="深度玩家吉祥物" width={56} height={56} />
      </div>
      <SearchField className="support-d3-search" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} onClear={() => setDraftQuery('')} onSearch={() => setQuery(draftQuery.trim())} placeholder="输入游戏名称" aria-label="搜索游戏" />
    </header>
    <div className="support-d3-game-scroll">
      {!query && <><section><Heading as="h2" variant="section">最近浏览</Heading><div className="support-d3-recent-games">{recentGames.map((item) => <GameButton key={item.code} game={item} large onSelect={onSelect} />)}</div></section><section><Heading as="h2" variant="section">热门推荐</Heading><div className="support-d3-hot-games">{allGames.slice(0, 10).map((item) => <GameButton key={item.code} game={item} onSelect={onSelect} />)}</div></section></>}
      <section className="support-d3-all-games"><nav aria-label="游戏端类型"><b>全部</b><span>端游</span><span>手游</span></nav><small>A</small><div>{filtered.map((item) => <button type="button" key={item.code} onClick={() => onSelect(item)}><GameMark game={item} /><b>{item.name}</b><ChevronRight size={15} aria-hidden="true" /></button>)}</div></section>
    </div>
  </main>
}

function GameButton({ game, large = false, onSelect }: { game: HomeGame; large?: boolean; onSelect: (game: HomeGame) => void }) {
  return <button type="button" className={large ? 'large' : ''} onClick={() => onSelect(game)}><GameMark game={game} /><span>{game.name}</span></button>
}

function GameMark({ game }: { game: HomeGame }) {
  return <i className={`support-d3-game-mark game-${game.code}`}>{game.image ? <img src={game.image} alt="" /> : <span>{game.name.slice(0, game.name.startsWith('Apex') ? 2 : 1)}</span>}</i>
}

function SupportConversation({ conversation, messages, game, scenario, consultationProduct, initialSettings, onBack }: Props & { game: HomeGame; scenario: string | null; consultationProduct?: ProductDetail; initialSettings: boolean; onBack: () => void }) {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [pending, setPending] = useState<ConversationMessage[]>([])
  const [settingsOpen, setSettingsOpen] = useState(initialSettings)
  const [pinned, setPinned] = useState(false)
  const [muted, setMuted] = useState(true)
  const [cleared, setCleared] = useState(false)
  const [validation, setValidation] = useState('')
  const [toast, setToast] = useState('')
  const [imagePreview, setImagePreview] = useState('')
  const [pendingProduct, setPendingProduct] = useState<ProductDetail | undefined>(consultationProduct)
  const [sentProduct, setSentProduct] = useState<ProductDetail>()
  const fileRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => { requestAnimationFrame(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight })) }, [pending])
  useEffect(() => { setPendingProduct(consultationProduct); setSentProduct(undefined) }, [consultationProduct])
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }, [imagePreview])
  useEffect(() => {
    if (!settingsOpen) return undefined
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSettingsOpen(false) }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [settingsOpen])

  const extraMessages = messages.filter((message) => message.id !== 'support-welcome')
  const visibleMessages = cleared ? [] : [...extraMessages, ...pending].sort((a, b) => a.createdAt - b.createdAt)
  const send = async (content = text) => {
    const issue = validateMessageText(content)
    setValidation(issue)
    if (issue) return
    setCleared(false)
    const local = createPendingMessage(conversation.id, content, Date.now(), `support-local-${Date.now()}`)
    setPending((current) => [...current, local]); setText('')
    const result = await messageRepository.sendText(conversation.id, content, local.id)
    setPending((current) => result.ok ? current.filter((message) => message.id !== local.id) : current.map((message) => message.id === local.id ? result.message : message))
    if (!result.ok) setToast('发送失败，请重试')
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void send() }
  const chooseImage = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { setToast('请选择图片文件'); return }
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(URL.createObjectURL(file))
  }
  const clearHistory = () => { setCleared(true); setPending([]); setSettingsOpen(false); setToast('已清空本地聊天记录') }
  const sendProduct = () => {
    if (!pendingProduct) return
    setSentProduct(pendingProduct)
    setPendingProduct(undefined)
    setCleared(false)
    setToast('已加入本地会话预览，未发送到真实客服后台')
  }
  const recommendedProducts = products.filter(item => item.gameCode === game.code).slice(0, 2)

  return <main className="support-d3-page support-d3-chat" data-node-id="3681:27585">
    <header className="support-d3-chat-header"><SupportStatusBar nodeId="3681:27585" /><div><button type="button" onClick={onBack} aria-label="返回"><ArrowLeft size={21} /></button><span><Heading as="h1" variant="page">{game.name} · 专属客服 <em>官方</em></Heading><small><b>在线</b> 服务时间 09:30–00:30</small></span><button type="button" className="more" onClick={() => setSettingsOpen(true)} aria-label="消息设置"><MoreHorizontal size={21} /></button></div></header>
    <div className="support-d3-log" ref={logRef} role="log" aria-live="polite" aria-label="客服聊天记录">
      {!cleared && <><time>13:56</time>{scenario !== 'recommend' && <><div className="support-d3-buyer"><p>你好</p><span aria-hidden="true">♙</span><small>已读</small></div><div className="support-d3-agent"><span aria-hidden="true">萌</span><div><small>萌萌 · {game.name}专属客服 <em>官方</em></small><p>{scenario === 'faq' ? '你好，我是平台客服萌萌。交易规则、换绑、退款和售后流程都可以问我。' : `老板你好，我是${game.name}的专属客服。看中的号可以把编号发我，我帮你核对账号情况和价格。`}</p><section><b>你可能想问</b>{faq.map((question) => <button type="button" key={question} onClick={() => void send(question)}>{question}<ChevronRight size={14} /></button>)}</section></div></div><p className="support-d3-safety">请勿在站外私下转账或提供验证码</p></>}{scenario === 'recommend' && <SupportRecommendations game={game} products={recommendedProducts} />}</>}
      {sentProduct && <div className="support-d3-sent-product"><small>你发送了一个商品 · 本地预览</small><SupportProductCard product={sentProduct} compact /></div>}
      {visibleMessages.map((message) => <div className={`support-d3-extra sender-${message.sender}`} key={message.id}><p>{message.content}</p>{message.delivery === 'failed' && <button type="button" onClick={() => void send(message.content)}>重新发送</button>}</div>)}
    </div>
    <footer className="support-d3-composer">{pendingProduct && <div className="support-d3-pending-product"><SupportProductCard product={pendingProduct} compact /><button type="button" className="support-d3-product-close" onClick={() => setPendingProduct(undefined)} aria-label="关闭待发送商品"><X size={17} /></button><button type="button" className="support-d3-product-send" onClick={sendProduct}>发送商品</button></div>}<div className="support-d3-actions"><button type="button" onClick={() => setToast('感谢你的评价')}><Star size={13} />评价客服</button><button type="button" onClick={() => navigate(`/game?gameCode=${game.code}`)}><ShoppingBag size={13} />咨询商品</button><button type="button" onClick={() => navigate('/orders?type=bought')}><MessageSquareText size={13} />咨询订单</button><button type="button" onClick={() => navigate('/feedback')}><MessageSquareText size={13} />问题反馈</button></div>{scenario === 'product' && !consultationProduct && !sentProduct && <small role="alert" className="support-d3-product-missing">商品信息已失效，请返回商品页重新咨询</small>}{imagePreview && <div className="support-d3-image-preview"><img src={imagePreview} alt="待发送图片预览" /><button type="button" onClick={() => { URL.revokeObjectURL(imagePreview); setImagePreview('') }}>移除</button><small>仅本地预览，不会上传</small></div>}<form onSubmit={submit}><input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => chooseImage(event.target.files?.[0])} /><button type="button" onClick={() => fileRef.current?.click()} aria-label="添加图片"><CirclePlus size={22} /></button><textarea value={text} onChange={(event) => { setText(event.target.value); setValidation('') }} placeholder="输入消息，@ 可提醒成员…" aria-label="输入你的问题" maxLength={1000} /><button type="submit" className="support-d3-text-send" disabled={!text.trim()}>发送</button></form>{validation && <small role="alert">{validation}</small>}</footer>
    <BottomSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="消息设置" className="support-d3-settings-sheet" actions={<Button variant="outline" fullWidth onClick={clearHistory}>清空聊天记录</Button>}>
      <div className="support-d3-settings-list" data-node-id="3681:27714">
        <Cell label="置顶消息" description="在消息列表中优先展示" arrow={false} trailing={<ToggleSwitch checked={pinned} label="置顶消息" onCheckedChange={setPinned} />} />
        <Cell label="消息免打扰" description="不再推送该会话通知" arrow={false} trailing={<ToggleSwitch checked={muted} label="消息免打扰" onCheckedChange={setMuted} />} />
        <Cell label="投诉服务" onClick={() => { setSettingsOpen(false); setToast('投诉入口暂未接入真实服务') }} />
        <Cell label="问题反馈" to="/feedback" />
      </div>
    </BottomSheet>
    <Toast message={toast} onDismiss={() => setToast('')} />
  </main>
}

function SupportProductCard({ product, compact = false }: { product: ProductDetail; compact?: boolean }) {
  return <Link className={`support-d3-product-card${compact ? ' compact' : ''}`} to={`/goods/${product.id}`}><span className="support-d3-product-image"><img src={product.gallery[0] ?? product.gameIcon} alt="" />{product.verified && <em>已验号</em>}</span><span><b>{product.productCode}</b><strong>¥{product.price.toLocaleString('zh-CN')}</strong><small>可直接发送 · 一起发送</small></span></Link>
}

function SupportRecommendations({ game, products: recommendations }: { game: HomeGame; products: Product[] }) {
  return <><section className="support-d3-recommend" aria-labelledby="support-recommend-title"><Heading id="support-recommend-title" as="h2" variant="section">找号结果</Heading><p>给你挑了几个{game.name}的在售账号，点开卡片看完整信息，合适可以直接下单。</p>{recommendations.length ? recommendations.map(product => <Link key={product.id} to={`/goods/${product.id}`} className="support-d3-recommend-card"><span className="support-d3-product-image"><img src={product.image} alt="" />{product.verified && <em>已验号</em>}</span><span><b>{product.displayTitle ?? product.title}</b><small>{product.tags.slice(0, 3).join(' · ')}</small><span>{product.tags.slice(0, 2).map(tag => <i key={tag}>{tag}</i>)}</span><strong>¥{product.price.toLocaleString('zh-CN')}</strong><p>带{product.skinCount}个皮肤，支持平台担保交易。</p></span></Link>) : <p className="support-d3-recommend-empty">当前游戏暂无可推荐商品</p>}</section><section className="support-d3-sell-entry"><Heading as="h2" variant="section">卖号/回收入口</Heading><p>想出售账号？进入回收页选择游戏并获取报价。</p><Link to="/sell">进入卖号/回收页</Link></section></>
}
