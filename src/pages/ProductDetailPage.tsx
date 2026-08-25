import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Heart, Share2 } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { buildOrderPreviewUrl, canPurchase, getPurchaseAmount, nextGalleryIndex, requiresSecondConfirmation } from '../components/productDetailModel'
import { useAuthPrompt, useAuthStatus } from '../components/AuthAccess'
import { assetPath } from '../components/assetPath'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import { productDetailRepository } from '../repository/productDetailRepository'
import { favoriteRepository } from '../repository/favoriteRepository'
import type { ProductDetail, PurchasePackage } from '../types/productDetail'
import '../styles/product-detail.css'

const asset = (name: string) => assetPath(`assets/product-detail-v2/${name}`)
const tabs = [['profile', '资料'], ['assets', '资产'], ['description', '描述'], ['guarantee', '保障'], ['similar', '相似账号']] as const
type TabId = typeof tabs[number][0]
type Sheet = 'rules' | 'purchase' | null

function DetailDialog({ open, label, className, onClose, children }: { open: boolean; label: string; className: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusables = () => [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])]
    requestAnimationFrame(() => focusables()[0]?.focus())
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const items = focusables(); if (!items.length) return
      const first = items[0]; const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); document.body.style.overflow = oldOverflow; previous?.focus() }
  }, [onClose, open])
  if (!open) return null
  return <div className={`detail-dialog-layer ${className}`}><button type="button" className="detail-dialog-mask" aria-label={`关闭${label}`} onClick={onClose} /><section ref={ref} role="dialog" aria-modal="true" aria-label={label}>{children}</section></div>
}

function DetailHeader({ compact, detail, onBack, onShare }: { compact: boolean; detail: ProductDetail; onBack: () => void; onShare: () => void }) {
  return <header className="detail-header"><div className="detail-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div><div className="detail-titlebar"><button type="button" onClick={onBack} aria-label="返回"><ArrowLeft size={20} strokeWidth={2} aria-hidden="true" /></button><div className={compact ? 'show' : ''}><strong>¥{detail.price.toLocaleString('zh-CN')}</strong><span>{detail.gameName} · {detail.platform}</span></div><button type="button" onClick={onShare} aria-label="分享商品"><Share2 size={19} strokeWidth={2} aria-hidden="true" /></button></div></header>
}

export function ProductDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const authenticated = useAuthStatus()
  const { requireAuth } = useAuthPrompt()
  const detail = productDetailRepository.getById(id)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [activeAssetCategory, setActiveAssetCategory] = useState(detail?.assetCategories[0]?.name ?? '')
  const [assetExpanded, setAssetExpanded] = useState(false)
  const [compact, setCompact] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [packageType, setPackageType] = useState<PurchasePackage>('PREMIUM')
  const [standardConfirmed, setStandardConfirmed] = useState(false)
  const [toast, setToast] = useState('')
  const closeGallery = useCallback(() => setGalleryIndex(null), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  useEffect(() => {
    if (!detail) return
    setActiveAssetCategory(detail.assetCategories[0]?.name ?? '')
    setAssetExpanded(false)
  }, [detail])
  useEffect(() => {
    if (!detail) return undefined
    if (!authenticated) { setFavorite(false); return undefined }
    const syncFavorite = () => {
      try { setFavorite(favoriteRepository.isFavorite(detail.id)) }
      catch { setToast('收藏状态加载失败') }
    }
    syncFavorite()
    return favoriteRepository.subscribe(syncFavorite)
  }, [authenticated, detail])
  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (galleryIndex === null || !detail) return undefined
    const move = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setGalleryIndex((current) => nextGalleryIndex(current ?? 0, -1, detail.gallery.length))
      if (event.key === 'ArrowRight') setGalleryIndex((current) => nextGalleryIndex(current ?? 0, 1, detail.gallery.length))
    }
    window.addEventListener('keydown', move)
    return () => window.removeEventListener('keydown', move)
  }, [detail, galleryIndex])

  const similar = useMemo(() => detail ? productDetailRepository.getSimilar(detail) : [], [detail])
  if (!detail) return <main className="product-detail-page detail-not-found"><section><b>商品不存在</b><h1>没有找到该商品</h1><p>商品可能已下架，或链接中的编号有误。</p><Link to="/game?gameCode=wzry">返回商品列表</Link></section></main>

  const back = () => window.history.length > 1 ? navigate(-1) : navigate(`/game?gameCode=${detail.gameCode}`)
  const copyText = async (value: string) => {
    let input: HTMLTextAreaElement | null = null
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
      else {
        input = document.createElement('textarea'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.appendChild(input); input.select()
        if (!document.execCommand('copy')) throw new Error('copy failed')
      }
      return true
    } catch { return false } finally { input?.remove() }
  }
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: detail.gameName, text: detail.title, url: window.location.href })
      else setToast(await copyText(window.location.href) ? '商品链接已复制' : '复制失败，请手动复制')
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') setToast(await copyText(window.location.href) ? '商品链接已复制' : '暂时无法分享')
    }
  }
  const toggleFavorite = () => {
    if (!requireAuth({ title: '登录后收藏商品', description: '登录后可收藏喜欢的商品，并在“我的收藏”中统一管理。', returnTo: `/goods/${detail.id}` })) return
    const next = !favorite
    const status = detail.status === 'on_sale' ? 'on_sale' : detail.status === 'reserved' ? 'trading' : detail.status === 'sold' ? 'sold' : 'off_shelf'
    const succeeded = next ? favoriteRepository.add(detail.id, status, Date.now()) : favoriteRepository.remove(detail.id)
    if (!succeeded) { setToast(next ? '收藏失败，请重试' : '取消收藏失败，请重试'); return }
    setToast(next ? '已收藏' : '已取消收藏')
  }
  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const top = event.currentTarget.scrollTop
    setCompact(top > 150)
    let current: TabId = 'profile'
    for (const [tab] of tabs) if ((sectionRefs.current[tab]?.offsetTop ?? Infinity) <= top + 150) current = tab
    setActiveTab(current)
  }
  const goTab = (tab: TabId) => { setActiveTab(tab); sectionRefs.current[tab]?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const moveTabFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    const index = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement))
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    items[next].focus(); items[next].click()
  }
  const copyGroup = async () => setToast(await copyText(detail.groupNumber) ? '群号已复制' : '复制失败，请手动复制')
  const openPurchase = () => {
    if (!requireAuth({ title: '登录后购买商品', description: '下单、付款和查看交易进度需要登录账号。', returnTo: `/goods/${detail.id}` })) return
    setPackageType('PREMIUM'); setStandardConfirmed(false); setSheet('purchase')
  }
  const openSupport = () => {
    if (requireAuth({ title: '登录后联系客服', description: '登录后可查看客服回复并继续咨询该商品。', returnTo: SUPPORT_CONVERSATION_ROUTE })) navigate(SUPPORT_CONVERSATION_ROUTE)
  }
  const confirmPurchase = () => {
    if (!canPurchase(detail)) return
    if (requiresSecondConfirmation(packageType) && !standardConfirmed) { setStandardConfirmed(true); return }
    navigate(buildOrderPreviewUrl(detail.id, packageType))
  }
  const activeCategory = detail.assetCategories.find((category) => category.name === activeAssetCategory) ?? detail.assetCategories[0]
  const process = detail.gameCode === 'sjzxd' ? ['付款', '进交易群', '同步资料', '验号/换绑', '完成'] : ['下单', '验号', '换绑', '合同', '完成']

  return <main className="product-detail-page">
    <DetailHeader compact={compact} detail={detail} onBack={back} onShare={share} />
    <div className="product-detail-scroll" ref={scrollRef} onScroll={onScroll}>
      <section className="detail-overview">
        <div className="detail-price"><strong>¥{detail.price.toLocaleString('zh-CN')}</strong>{detail.originalPrice && <del>¥{detail.originalPrice.toLocaleString('zh-CN')}</del>}<span>在售</span>{detail.wantCount !== undefined && <small>{detail.wantCount} 人想要</small>}</div>
        <h1 className={expanded ? 'expanded' : ''}>{detail.title}</h1><button className="detail-expand" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? '收起' : '查看更多'} ›</button>
        <div className="detail-game"><img src={detail.gameIcon} alt="" /><b>{detail.gameName}</b><i /> <span>{detail.platform}</span><small>编号 {detail.productCode}</small></div>
        <div className="detail-flags"><span>在售</span>{detail.verified && <b>平台验号</b>}{detail.negotiable && <em>支持议价</em>}</div>
        <div className="detail-metrics">{detail.metrics.map((metric) => <div key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong></div>)}</div>
        <div className="detail-summary">{detail.summary.map((metric) => <span key={metric.label}>{metric.label} <b>{metric.value}</b></span>)}</div>
      </section>
      <section className="detail-shots"><header><h2>账号实拍</h2><span>{detail.gallery.length} 张</span></header><div>{detail.gallery.slice(0, 3).map((image, index) => <button type="button" key={image} onClick={() => setGalleryIndex(index)} aria-label={`预览游戏截图 ${index + 1}`}><img src={image} alt={`游戏截图 ${index + 1}`} loading="lazy" /><small>截图{index + 1}</small></button>)}<button type="button" className="detail-more-shots" onClick={() => setGalleryIndex(3)} aria-label={`查看全部 ${detail.gallery.length} 张游戏截图`}><b>+{Math.max(0, detail.gallery.length - 3)}</b><small>共{detail.gallery.length}张</small></button></div></section>
      <nav className="detail-tabs" role="tablist" aria-label="商品详情分区" onKeyDown={moveTabFocus}>{tabs.map(([tab, label]) => <button type="button" role="tab" id={`detail-tab-${tab}`} aria-controls={`detail-panel-${tab}`} aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1} key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => goTab(tab)}>{label}</button>)}</nav>
      <section id="detail-panel-profile" role="tabpanel" aria-labelledby="detail-tab-profile" className="detail-section" ref={(node) => { sectionRefs.current.profile = node }}><div className="detail-section-title"><span>✓</span><h2>{detail.verified ? '平台验号通过' : '账号资料'}</h2><small>{detail.verified ? '深度玩家核验' : '商品发布资料'}</small></div><div className="detail-report"><div><small>游戏区服</small><b>{detail.platform}</b></div><div><small>段位/等级</small><b>{detail.rank}</b></div><div><small>实名状态</small><b>{detail.realName}</b></div><div><small>能否二次实名</small><b>{detail.secondRealName ? '是' : '否'}</b></div>{detail.summary.map((item) => <div key={item.label}><small>{item.label}</small><b>{item.value}</b></div>)}</div><p className="detail-report-note"><b>资料完整性说明：</b>账号信息来自商品发布资料，购买前请结合全部截图核对。</p></section>
      <section id="detail-panel-assets" role="tabpanel" aria-labelledby="detail-tab-assets" className="detail-section" ref={(node) => { sectionRefs.current.assets = node }}><header className="detail-content-heading"><h2>{detail.gameCode === 'sjzxd' ? '核心资产' : '资产清点'}</h2><small>数据来自商品发布资料</small></header><div className="detail-asset-total"><strong>{detail.gameCode === 'sjzxd' ? '547M' : detail.heroCount}</strong><span>{detail.gameCode === 'sjzxd' ? '总资产' : `英雄 / 全服 ${Math.max(detail.heroCount, 121)}`}</span></div><div className="detail-category-pills" role="tablist" aria-label="资产分类">{detail.assetCategories.map((category) => <button type="button" role="tab" aria-selected={activeCategory?.name === category.name} className={activeCategory?.name === category.name ? 'active' : ''} key={category.name} onClick={() => { setActiveAssetCategory(category.name); setAssetExpanded(false) }}>{category.name}<b>{category.count}</b></button>)}</div>{activeCategory && <article className="detail-category-preview"><header><h3>{activeCategory.name}</h3><b>{activeCategory.count} 项</b></header><div className="detail-asset-progress"><span style={{ width: `${Math.min(100, Math.round(activeCategory.items.length / activeCategory.count * 100))}%` }} /></div><p className={assetExpanded ? 'expanded' : ''}>{activeCategory.items.join('、')}{activeCategory.count > activeCategory.items.length ? ` 等 ${activeCategory.count} 项` : ''}</p>{activeCategory.items.length > 4 && <button type="button" aria-expanded={assetExpanded} onClick={() => setAssetExpanded((value) => !value)}>{assetExpanded ? '收起资产' : `展开全部${activeCategory.count}项`}</button>}</article>}</section>
      <section id="detail-panel-description" role="tabpanel" aria-labelledby="detail-tab-description" className="detail-section" ref={(node) => { sectionRefs.current.description = node }}><header className="detail-content-heading"><h2>商品描述</h2></header>{detail.description.map((line) => <p className="detail-description" key={line}>{line}</p>)}</section>
      <section id="detail-panel-guarantee" role="tabpanel" aria-labelledby="detail-tab-guarantee" className="detail-section" ref={(node) => { sectionRefs.current.guarantee = node }}><header className="detail-content-heading"><h2>平台保障范围</h2><button type="button" onClick={() => setSheet('rules')}>查看规则</button></header><div className="detail-guarantee-grid"><div><b>✓ 覆盖</b>{detail.guaranteeCovered.map((item) => <span key={item}>{item}</span>)}</div><div><b>× 不覆盖</b>{detail.guaranteeExcluded.map((item) => <span key={item}>{item}</span>)}</div></div><ol className="detail-process">{process.map((item) => <li key={item}>{item}</li>)}</ol><div className="detail-community"><img src={asset('community-logo.png')} alt="" /><span><b>{detail.groupName}</b><small>群号：{detail.groupNumber}</small></span><button type="button" onClick={copyGroup}>复制群号</button><button type="button" onClick={openSupport}>联系客服</button></div><div className="detail-tips"><h3>温馨提示</h3>{detail.tips.map((item, index) => <p key={item}>{index + 1}. {item}</p>)}</div></section>
      <section id="detail-panel-similar" role="tabpanel" aria-labelledby="detail-tab-similar" className="detail-section detail-similar" ref={(node) => { sectionRefs.current.similar = node }}><header className="detail-content-heading"><h2>相似账号</h2></header>{similar.length ? similar.map((item) => <Link key={item.id} to={`/goods/${item.id}`}><img src={item.gallery[0]} alt="" /><span><b>{item.gameName} · {item.platform}</b><small>{item.title}</small></span><strong>¥{item.price.toLocaleString('zh-CN')}</strong></Link>) : <p className="detail-description">暂无同游戏相似账号</p>}</section>
    </div>
    <footer className="detail-actions"><button type="button" className={favorite ? 'favorite' : ''} aria-pressed={favorite} onClick={toggleFavorite}><Heart size={21} strokeWidth={2} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />{favorite ? '已收藏' : '收藏'}</button><button type="button" onClick={() => setSheet('rules')}>查看规则</button><button type="button" className="primary" disabled={!canPurchase(detail)} onClick={openPurchase}>立即购买</button></footer>
    <DetailDialog open={galleryIndex !== null} label="商品图片预览" className="detail-gallery-dialog" onClose={closeGallery}>{galleryIndex !== null && <><button type="button" className="dialog-close" onClick={closeGallery} aria-label="关闭图片预览">×</button><img src={detail.gallery[galleryIndex]} alt={`商品大图 ${galleryIndex + 1}`} /><button type="button" className="gallery-prev" onClick={() => setGalleryIndex(nextGalleryIndex(galleryIndex, -1, detail.gallery.length))} aria-label="上一张">‹</button><button type="button" className="gallery-next" onClick={() => setGalleryIndex(nextGalleryIndex(galleryIndex, 1, detail.gallery.length))} aria-label="下一张">›</button><span>{galleryIndex + 1} / {detail.gallery.length}</span></>}</DetailDialog>
    <DetailDialog open={sheet !== null} label={sheet === 'purchase' ? '确认购买' : '规则问答'} className="detail-sheet-dialog" onClose={closeSheet}><header><h2>{sheet === 'purchase' ? '确认购买' : '规则问答'}</h2><button type="button" onClick={closeSheet} aria-label="关闭">×</button></header>{sheet === 'rules' && <div className="detail-sheet-content"><img className="sheet-avatar" src={asset('advisor.png')} alt="规则问答" /><h3>买前帮你看清</h3><p>钱先由平台托管，付款后开放订单交易群，按步骤同步资料、验号和换绑。找回问题须在规则期限内联系客服处理。</p><ul>{detail.guaranteeCovered.map((item) => <li key={item}>{item}</li>)}</ul></div>}{sheet === 'purchase' && <div className="detail-sheet-content purchase-options"><p>请选择交易保障方案，本地演示不会发起真实支付。</p><button type="button" className={packageType === 'PREMIUM' ? 'selected' : ''} aria-pressed={packageType === 'PREMIUM'} onClick={() => { setPackageType('PREMIUM'); setStandardConfirmed(false) }}><span><b>包赔版</b><small>包含找回包赔服务</small></span><strong>¥{getPurchaseAmount(detail.price, 'PREMIUM').toLocaleString('zh-CN')}</strong></button><button type="button" className={packageType === 'STANDARD' ? 'selected' : ''} aria-pressed={packageType === 'STANDARD'} onClick={() => { setPackageType('STANDARD'); setStandardConfirmed(false) }}><span><b>标准版</b><small>不包含找回包赔，需二次确认</small></span><strong>¥{getPurchaseAmount(detail.price, 'STANDARD').toLocaleString('zh-CN')}</strong></button>{standardConfirmed && <p className="purchase-warning" role="alert">标准版不含找回包赔服务，请再次确认。</p>}<button type="button" className="sheet-main-button" onClick={confirmPurchase}>{standardConfirmed ? '再次确认标准版' : `确认购买 · ¥${getPurchaseAmount(detail.price, packageType).toLocaleString('zh-CN')}`}</button></div>}</DetailDialog>
    {toast && <div className="detail-toast" role="status">{toast}</div>}
  </main>
}

export function OrderPreviewPage() {
  const [params] = useSearchParams()
  const detail = productDetailRepository.getById(params.get('goodsId') ?? '')
  const packageType = params.get('packageType') === 'STANDARD' ? 'STANDARD' : 'PREMIUM'
  return <main className="product-detail-page order-preview-page"><section><span>订单预览</span>{detail ? <><h1>{detail.gameName} · {detail.productCode}</h1><p>{packageType === 'PREMIUM' ? '包赔版' : '标准版'} · ¥{getPurchaseAmount(detail.price, packageType).toLocaleString('zh-CN')}</p><small>本地演示已进入确认页，不会发起真实支付。</small><Link to={`/goods/${detail.id}`}>返回商品详情</Link></> : <><h1>商品不存在</h1><Link to="/game?gameCode=wzry">返回商品列表</Link></>}</section></main>
}
