import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight, Copy, Heart, Share2 } from 'lucide-react'
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
const tabs = [['profile', '验号'], ['assets', '资产'], ['description', '描述'], ['guarantee', '保障'], ['similar', '推荐']] as const
type TabId = typeof tabs[number][0]

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
  const tabScrollTopRef = useRef<number | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [activeAssetCategory, setActiveAssetCategory] = useState(detail?.assetCategories[0]?.name ?? '')
  const [assetExpanded, setAssetExpanded] = useState(false)
  const [compact, setCompact] = useState(false)
  const [reportExpanded, setReportExpanded] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [packageType, setPackageType] = useState<PurchasePackage>('PREMIUM')
  const [standardConfirmed, setStandardConfirmed] = useState(false)
  const [toast, setToast] = useState('')
  const closeGallery = useCallback(() => setGalleryIndex(null), [])
  const closePurchase = useCallback(() => setPurchaseOpen(false), [])

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
  useLayoutEffect(() => {
    const scrollTop = tabScrollTopRef.current
    const scroller = scrollRef.current
    if (scrollTop === null || !scroller) return
    scroller.scrollTop = scrollTop
    tabScrollTopRef.current = null
  }, [activeTab])

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
    setCompact(event.currentTarget.scrollTop > 230)
  }
  const goTab = (tab: TabId) => {
    tabScrollTopRef.current = scrollRef.current?.scrollTop ?? null
    setActiveTab(tab)
    setReportExpanded(false)
  }
  const moveTabFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    const index = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement))
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    items[next].focus(); items[next].click()
  }
  const copyGroup = async () => setToast(await copyText(detail.groupNumber) ? '群号已复制' : '复制失败，请手动复制')
  const copyProductCode = async () => setToast(await copyText(detail.productCode) ? '商品编号已复制' : '复制失败，请手动复制')
  const openPurchase = () => {
    if (!requireAuth({ title: '登录后购买商品', description: '下单、付款和查看交易进度需要登录账号。', returnTo: `/goods/${detail.id}` })) return
    setPackageType('PREMIUM'); setStandardConfirmed(false); setPurchaseOpen(true)
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
  const priceDrop = detail.originalPrice ? Math.max(0, detail.originalPrice - detail.price) : 0
  const rankValue = Number(detail.rank.match(/\d+/)?.[0] ?? 0)
  const verificationItems = [
    { label: '区服', value: detail.platform.replace(/区$/, '') },
    { label: '段位', value: detail.rank },
    { label: '实名状态', value: detail.realName },
    { label: '英雄数量', value: detail.heroCount ? String(detail.heroCount) : '—' },
    { label: '皮肤数量', value: detail.skinCount ? String(detail.skinCount) : '—' },
    { label: '二次实名', value: detail.secondRealName ? '支持' : '不支持' },
    { label: '登录方式', value: detail.platform.includes('微信') ? '微信' : detail.platform.includes('Steam') ? 'Steam' : 'QQ' },
    { label: '议价状态', value: detail.negotiable ? '支持议价' : '不议价' },
  ]
  const assetPreviewImages = detail.gameCode === 'wzry'
    ? ['hero-1.png', 'hero-2.png', 'hero-3.png', 'hero-4.png'].map(asset)
    : detail.gallery.slice(0, 4)

  return <main className="product-detail-page">
    <DetailHeader compact={compact} detail={detail} onBack={back} onShare={share} />
    <div className="product-detail-scroll" ref={scrollRef} onScroll={onScroll}>
      <section className="detail-overview">
        <div className="detail-price"><strong>¥{detail.price.toLocaleString('zh-CN')}</strong><span>{priceDrop ? `7天 ↓¥${priceDrop.toLocaleString('zh-CN')}` : '验号通过'}</span>{detail.wantCount !== undefined && <small>{detail.wantCount} 人想要</small>}</div>
        <div className="detail-game"><img src={detail.gameIcon} alt="" /><b>{detail.gameName}</b><i /><span>{detail.platform}</span></div>
        <div className="detail-metrics">{detail.metrics.map((metric) => <div key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong></div>)}</div>
        <button className="detail-summary" type="button" onClick={() => goTab('description')}><span>{detail.summary.map((metric) => `${metric.label}${metric.value}`).join(' · ')}</span><b>查看全部{verificationItems.length + detail.summary.length}项 <ChevronRight size={13} aria-hidden="true" /></b></button>
      </section>
      <section className="detail-shots"><header><div><h2>账号实拍</h2><b>验号截图</b></div><span>最近验号留存</span></header><div>{detail.gallery.slice(0, 3).map((image, index) => <button type="button" key={image} onClick={() => setGalleryIndex(index)} aria-label={`预览游戏截图 ${index + 1}`}><img src={image} alt={`游戏截图 ${index + 1}`} loading="lazy" /><small>{['皮肤墙', '英雄墙', '战绩'][index]}</small></button>)}<button type="button" className="detail-more-shots" onClick={() => setGalleryIndex(Math.min(3, detail.gallery.length - 1))} aria-label={`查看全部 ${detail.gallery.length} 张游戏截图`}><b>+{Math.max(0, detail.gallery.length - 3)}</b><small>共{detail.gallery.length}张</small></button></div></section>
      <nav className="detail-tabs" role="tablist" aria-label="商品详情分区" onKeyDown={moveTabFocus}>{tabs.map(([tab, label]) => <button type="button" role="tab" id={`detail-tab-${tab}`} aria-controls={`detail-panel-${tab}`} aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1} key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => goTab(tab)}>{label}</button>)}</nav>

      {activeTab === 'profile' && <section id="detail-panel-profile" role="tabpanel" aria-labelledby="detail-tab-profile" className="detail-section detail-verification"><div className="detail-section-title"><span>✓</span><h2>{detail.verified ? '平台验号通过' : '账号资料已收录'}</h2><small>深度玩家 · 最近核验</small></div><div className="detail-report">{verificationItems.map((item) => <div key={item.label}><small>{item.label}</small><b>{item.value}</b></div>)}</div><p className="detail-report-note"><b>密保完整性{detail.verified ? '通过' : '待确认'}</b>，账号资料来自平台验号与商品发布记录，购买前请结合全部截图核对。</p>{reportExpanded && <div className="detail-report-extra">{detail.description.map((line) => <p key={line}>{line}</p>)}</div>}<button type="button" className="detail-report-toggle" aria-expanded={reportExpanded} onClick={() => setReportExpanded((value) => !value)}>{reportExpanded ? '收起完整验号报告' : '查看完整验号报告'} <ChevronDown size={14} aria-hidden="true" /></button></section>}

      {activeTab === 'assets' && <section id="detail-panel-assets" role="tabpanel" aria-labelledby="detail-tab-assets" className="detail-section detail-assets-panel"><header className="detail-content-heading"><h2>{detail.gameCode === 'sjzxd' ? '核心资产' : '资产清点'}</h2><small>数据来自验号报告</small></header><div className="detail-category-pills" role="tablist" aria-label="资产分类">{detail.assetCategories.map((category) => <button type="button" role="tab" aria-selected={activeCategory?.name === category.name} className={activeCategory?.name === category.name ? 'active' : ''} key={category.name} onClick={() => { setActiveAssetCategory(category.name); setAssetExpanded(false) }}>{category.name}<b>{category.count}</b></button>)}</div>{activeCategory && <><div className="detail-asset-total"><strong>{activeCategory.count}</strong><span>/ 已收录 {Math.max(activeCategory.count, activeCategory.items.length)} 项</span></div><div className="detail-asset-progress"><span style={{ width: `${Math.min(100, Math.round(activeCategory.items.length / Math.max(1, activeCategory.count) * 100))}%` }} /></div><div className="detail-asset-gallery">{assetPreviewImages.map((image, index) => <div key={`${image}-${index}`}><img src={image} alt="" loading="lazy" /><small>{activeCategory.items[index] ?? `资产 ${index + 1}`}</small></div>)}{activeCategory.count > 4 && <button type="button" onClick={() => setAssetExpanded((value) => !value)} aria-expanded={assetExpanded}><b>+{activeCategory.count - 4}</b><small>全部</small></button>}</div>{assetExpanded && <p className="detail-asset-list">{activeCategory.items.join('、')}{activeCategory.count > activeCategory.items.length ? ` 等 ${activeCategory.count} 项` : ''}</p>}</>}</section>}

      {activeTab === 'description' && <section id="detail-panel-description" role="tabpanel" aria-labelledby="detail-tab-description" className="detail-section detail-description-panel"><header className="detail-content-heading"><h2>账号信息</h2><small>资产与验号结论见上方</small></header><h3>基础信息</h3><dl className="detail-info-list"><div><dt>商品编号</dt><dd><button className="detail-product-code" type="button" onClick={copyProductCode} aria-label={`复制商品编号 ${detail.productCode}`}>{detail.productCode}<Copy size={13} strokeWidth={2} aria-hidden="true" /></button></dd></div><div><dt>所属游戏</dt><dd>{detail.gameName}</dd></div><div><dt>区服</dt><dd>{detail.platform}</dd></div><div><dt>最近验号</dt><dd>{detail.verified ? '平台已核验' : '卖家已提交'}</dd></div></dl><h3>交易属性 <span>验号核对</span></h3><dl className="detail-info-list"><div><dt>实名状态</dt><dd className="positive">{detail.realName}</dd></div><div><dt>换绑限制</dt><dd>{detail.secondRealName ? '支持二次实名' : '当前无明显限制'}</dd></div><div><dt>登录方式</dt><dd>{detail.platform.includes('微信') ? '微信' : detail.platform.includes('Steam') ? 'Steam' : 'QQ'}</dd></div><div><dt>交易限制</dt><dd>{detail.negotiable ? '支持议价' : '无'}</dd></div></dl><article className="detail-seller-note"><header><h3>卖家补充</h3><span>卖家描述</span></header>{detail.description.map((line) => <p key={line}>{line}</p>)}<p className="detail-full-title">{detail.title}</p></article></section>}

      {activeTab === 'guarantee' && <section id="detail-panel-guarantee" role="tabpanel" aria-labelledby="detail-tab-guarantee" className="detail-section detail-guarantee-panel"><header className="detail-content-heading"><h2>平台保障范围</h2><button type="button" onClick={openSupport}>联系客服 <ChevronRight size={13} aria-hidden="true" /></button></header><div className="detail-guarantee-grid"><div><b>✓ 平台保障</b>{detail.guaranteeCovered.map((item) => <span key={item}>{item}</span>)}</div></div><p className="detail-guarantee-note">换绑完成 72 小时后系统自动确认放款，如有疑问请及时联系客服。</p><ol className="detail-process">{process.map((item, index) => <li className={index < 2 ? 'done' : ''} key={item}>{item}</li>)}</ol><div className="detail-community"><img src={asset('community-logo.png')} alt="" /><span><b>{detail.groupName}</b><small>群号：{detail.groupNumber}</small></span><button type="button" onClick={copyGroup}>复制群号</button></div><div className="detail-tips"><h3>温馨提示</h3>{detail.tips.map((item, index) => <p key={item}>{index + 1}. {item}</p>)}</div></section>}

      {activeTab === 'similar' && <section id="detail-panel-similar" role="tabpanel" aria-labelledby="detail-tab-similar" className="detail-section detail-similar"><header className="detail-content-heading"><div><h2>同类比价</h2><span>从首屏推荐</span></div></header><article className="detail-current-product"><img src={detail.gallery[0]} alt="" /><span><small>当前 · {detail.gameName} · {detail.platform}</small><b>{detail.rank} · {detail.heroCount}英雄 · {detail.skinCount}皮肤</b></span><strong>¥{detail.price.toLocaleString('zh-CN')}</strong></article><div className="detail-compare-label"><span>与当前对比</span><small>按接近度排序</small></div>{similar.length ? similar.slice(0, 3).map((item) => { const itemRank = Number(item.rank.match(/\d+/)?.[0] ?? 0); const priceDiff = item.price - detail.price; return <Link key={item.id} to={`/goods/${item.id}`}><div className="detail-similar-main"><img src={item.gallery[0]} alt="" /><span><small>{item.gameName} · {item.platform}</small><b>{item.rank} · {item.heroCount}英雄 · {item.skinCount}皮肤</b></span><strong>¥{item.price.toLocaleString('zh-CN')}<small className={priceDiff <= 0 ? 'positive' : 'negative'}>{priceDiff === 0 ? '同价' : `${priceDiff > 0 ? '贵' : '便宜'} ¥${Math.abs(priceDiff)}`}</small></strong></div><div className="detail-differences"><span className={item.skinCount >= detail.skinCount ? 'positive' : 'negative'}>{item.skinCount - detail.skinCount >= 0 ? '+' : ''}{item.skinCount - detail.skinCount}<small>皮肤</small></span><span className={item.heroCount >= detail.heroCount ? 'positive' : 'negative'}>{item.heroCount - detail.heroCount >= 0 ? '+' : ''}{item.heroCount - detail.heroCount}<small>英雄</small></span><span className={itemRank >= rankValue ? 'positive' : 'negative'}>{itemRank - rankValue >= 0 ? '+' : ''}{itemRank - rankValue}★<small>段位</small></span></div></Link> }) : <p className="detail-description">暂无同游戏相似账号</p>}<p className="detail-compare-note">对比仅涉及价格与核心资产差异，账号真实性与属性请各自查看验号报告。</p></section>}
    </div>
    <footer className="detail-actions"><button type="button" className={favorite ? 'favorite' : ''} aria-pressed={favorite} onClick={toggleFavorite}><Heart size={21} strokeWidth={2} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />{favorite ? '已收藏' : '收藏'}</button><button type="button" onClick={openSupport}>咨询</button><button type="button" className="primary" disabled={!canPurchase(detail)} onClick={openPurchase}>立即购买</button></footer>
    <DetailDialog open={galleryIndex !== null} label="商品图片预览" className="detail-gallery-dialog" onClose={closeGallery}>{galleryIndex !== null && <><button type="button" className="dialog-close" onClick={closeGallery} aria-label="关闭图片预览">×</button><img src={detail.gallery[galleryIndex]} alt={`商品大图 ${galleryIndex + 1}`} /><button type="button" className="gallery-prev" onClick={() => setGalleryIndex(nextGalleryIndex(galleryIndex, -1, detail.gallery.length))} aria-label="上一张">‹</button><button type="button" className="gallery-next" onClick={() => setGalleryIndex(nextGalleryIndex(galleryIndex, 1, detail.gallery.length))} aria-label="下一张">›</button><span>{galleryIndex + 1} / {detail.gallery.length}</span></>}</DetailDialog>
    <DetailDialog open={purchaseOpen} label="确认购买" className="detail-sheet-dialog" onClose={closePurchase}><header><h2>确认购买</h2><button type="button" onClick={closePurchase} aria-label="关闭">×</button></header><div className="detail-sheet-content purchase-options"><p>请选择交易保障方案，本地演示不会发起真实支付。</p><button type="button" className={packageType === 'PREMIUM' ? 'selected' : ''} aria-pressed={packageType === 'PREMIUM'} onClick={() => { setPackageType('PREMIUM'); setStandardConfirmed(false) }}><span><b>包赔版</b><small>包含找回包赔服务</small></span><strong>¥{getPurchaseAmount(detail.price, 'PREMIUM').toLocaleString('zh-CN')}</strong></button><button type="button" className={packageType === 'STANDARD' ? 'selected' : ''} aria-pressed={packageType === 'STANDARD'} onClick={() => { setPackageType('STANDARD'); setStandardConfirmed(false) }}><span><b>标准版</b><small>不包含找回包赔，需二次确认</small></span><strong>¥{getPurchaseAmount(detail.price, 'STANDARD').toLocaleString('zh-CN')}</strong></button>{standardConfirmed && <p className="purchase-warning" role="alert">标准版不含找回包赔服务，请再次确认。</p>}<button type="button" className="sheet-main-button" onClick={confirmPurchase}>{standardConfirmed ? '再次确认标准版' : `确认购买 · ¥${getPurchaseAmount(detail.price, packageType).toLocaleString('zh-CN')}`}</button></div></DetailDialog>
    {toast && <div className="detail-toast" role="status">{toast}</div>}
  </main>
}

export function OrderPreviewPage() {
  const [params] = useSearchParams()
  const detail = productDetailRepository.getById(params.get('goodsId') ?? '')
  const packageType = params.get('packageType') === 'STANDARD' ? 'STANDARD' : 'PREMIUM'
  return <main className="product-detail-page order-preview-page"><section><span>订单预览</span>{detail ? <><h1>{detail.gameName} · {detail.productCode}</h1><p>{packageType === 'PREMIUM' ? '包赔版' : '标准版'} · ¥{getPurchaseAmount(detail.price, packageType).toLocaleString('zh-CN')}</p><small>本地演示已进入确认页，不会发起真实支付。</small><Link to={`/goods/${detail.id}`}>返回商品详情</Link></> : <><h1>商品不存在</h1><Link to="/game?gameCode=wzry">返回商品列表</Link></>}</section></main>
}
