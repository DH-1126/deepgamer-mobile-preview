import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, Check, ChevronRight, Copy, Info, UserRound } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TitleBlocks } from '@deepgamer/product-presentation'
import { buildOrderPreviewUrl, canPurchase, getPurchaseAmount, requiresSecondConfirmation } from '../components/productDetailModel'
import { useAuthPrompt, useAuthStatus } from '../components/AuthAccess'
import { GuestLoginFloatingBar } from '../components/LoginFloatingBar'
import { DesignPromptTrigger } from '../components/DesignPromptTrigger'
import { assetPath } from '../components/assetPath'
import { useDetailTitle } from '../components/titlePresentation'
import { buildProductConsultationRoute } from '../components/supportConsultationModel'
import { productDetailRepository } from '../repository/productDetailRepository'
import { favoriteRepository } from '../repository/favoriteRepository'
import type { ProductDetail, PurchasePackage } from '../types/productDetail'
import { isLinkedDataMode } from '../runtime/dataMode'
import { getLinkedState } from '../linked/linkedData'
import { getLinkedDetailView } from '../../../双端演示/src/detail-config'
import { LinkedCurrentDetailCard, LinkedSubmissionSnapshot } from '../linked/LinkedDetailCards'
import { findLinkedGoodsForDetail } from '../linked/linkedDetailViewModel'
import { BottomSheet, Button, Dialog, EmptyStateView, Heading, IconButton, ImagePreview, InfoList, MetricGrid, ProductActionBar, SectionHeader, StatusBadge, Tabs, Toast } from '../components/ui'
import { AssetInventory } from '../components/product-detail/AssetInventory'
import { GuaranteeRulesPanel } from '../components/product-detail/GuaranteeRulesPanel'
import { ProductDetailHeader } from '../components/product-detail/ProductDetailHeader'
import { SellerSummary } from '../components/product-detail/SellerSummary'
import { getDetailPresentation } from '../components/product-detail/detailPresentationModel'
import { useDetailSections } from '../components/product-detail/useDetailSections'
import { showAssetBackToTop, type SectionId } from '../components/product-detail/detailSectionModel'
import '../styles/product-detail.css'

const asset = (name: string) => assetPath(`assets/product-detail-draft5/${name}`)
const tabs = [['assets', '资产'], ['description', '描述'], ['guarantee', '保障']] as const

function DetailTitleIdentity({ detail }: { detail: ProductDetail }) {
  const { result } = useDetailTitle(detail)
  return <div className="detail-title-region"><img src={detail.gameIcon} alt="" /><TitleBlocks result={result} /></div>
}

export function ProductDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const authenticated = useAuthStatus()
  const { requireAuth } = useAuthPrompt()
  const [, setDetailRevision] = useState(0)
  const detail = productDetailRepository.getById(id)
  const { scrollRef, activeSection, pastTabTop, onScroll: syncSection, goToSection, returnToTabTop } = useDetailSections(id)
  const [assetRows, setAssetRows] = useState(0)
  const [sellerOpen, setSellerOpen] = useState(false)
  const [infoHint, setInfoHint] = useState('')
  const [compact, setCompact] = useState(false)
  const sellerSummaryRef = useRef<HTMLButtonElement>(null)
  const [favorite, setFavorite] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [packageType, setPackageType] = useState<PurchasePackage>('PREMIUM')
  const [standardConfirmed, setStandardConfirmed] = useState(false)
  const [toast, setToast] = useState('')
  const closeGallery = useCallback(() => setGalleryIndex(null), [])
  const closePurchase = useCallback(() => setPurchaseOpen(false), [])

  useEffect(() => productDetailRepository.subscribe(() => setDetailRevision((value) => value + 1)), [])

  useLayoutEffect(() => {
    if (!detail) return
    setAssetRows(0)
    setGalleryIndex(null); setSellerOpen(false); setRulesOpen(false); setPurchaseOpen(false)
    setCompact(false); setInfoHint(''); setToast('')
  }, [id])
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
  if (!detail) return <main className="product-detail-page detail-not-found"><section><b>商品不存在</b><Heading variant="result">没有找到该商品</Heading><p>商品可能已下架，或链接中的编号有误。</p><Link to="/game?gameCode=wzry">返回商品列表</Link></section></main>

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
    if (isLinkedDataMode) { setToast('联动演示暂未接入收藏，不会保存独立收藏状态'); return }
    if (!requireAuth({ title: '登录后收藏商品', description: '登录后可收藏喜欢的商品，并在“我的收藏”中统一管理。', returnTo: `/goods/${detail.id}` })) return
    const next = !favorite
    const status = detail.status === 'on_sale' ? 'on_sale' : detail.status === 'reserved' ? 'trading' : detail.status === 'sold' ? 'sold' : 'off_shelf'
    const succeeded = next ? favoriteRepository.add(detail.id, status, Date.now()) : favoriteRepository.remove(detail.id)
    if (!succeeded) { setToast(next ? '收藏失败，请重试' : '取消收藏失败，请重试'); return }
    setToast(next ? '已收藏' : '已取消收藏')
  }
  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const summary = sellerSummaryRef.current
    // Use the actual summary position instead of a fixed pixel threshold:
    // linked goods, wrapped titles and font scaling can change overview height.
    setCompact(Boolean(summary && summary.getBoundingClientRect().bottom <= event.currentTarget.getBoundingClientRect().top + .5))
    syncSection()
  }
  const copyProductCode = async () => setToast(await copyText(detail.productCode) ? '商品编号已复制' : '复制失败，请手动复制')
  const openPurchase = () => {
    if (isLinkedDataMode) { setToast('联动演示暂未接入订单与支付，不会创建独立模拟订单'); return }
    if (!requireAuth({ title: '登录后购买商品', description: '下单、付款和查看交易进度需要登录账号。', returnTo: `/goods/${detail.id}` })) return
    setPackageType('PREMIUM'); setStandardConfirmed(false); setPurchaseOpen(true)
  }
  const openSupport = () => {
    const destination = buildProductConsultationRoute(detail.id, detail.gameCode)
    if (requireAuth({ title: '登录后联系客服', description: '登录后可查看客服回复并继续咨询该商品。', returnTo: destination })) navigate(destination)
  }
  const confirmPurchase = () => {
    if (!canPurchase(detail)) return
    if (requiresSecondConfirmation(packageType) && !standardConfirmed) { setStandardConfirmed(true); return }
    navigate(buildOrderPreviewUrl(detail.id, packageType))
  }
  const presentation = getDetailPresentation(detail, isLinkedDataMode)
  const sellerSummary = presentation.sellerDescription.find(line => line.trim())?.trim() ?? ''
  const linkedState = isLinkedDataMode ? getLinkedState() : null
  const linkedGoods = linkedState ? findLinkedGoodsForDetail(linkedState, detail.id) : undefined
  const linkedDetailView = linkedState && linkedGoods
    ? getLinkedDetailView(linkedState, { gameCode: linkedGoods.gameCode, publishSnapshot: linkedGoods.publishSnapshot })
    : null
  const process = detail.gameCode === 'sjzxd' ? ['付款', '进交易群', '同步资料', '验号/换绑', '完成'] : ['下单', '验号', '换绑', '合同', '完成']
  const baseInfo = [
    { id: 'code', label: '商品编号', value: <span className="detail-code-value"><span>{detail.productCode}</span><IconButton className="detail-copy-code" size="sm" label={`复制商品编号 ${detail.productCode}`} onClick={copyProductCode}><Copy size={15} aria-hidden="true" /></IconButton></span> },
    { id: 'published', label: '发布时间', value: presentation.publishedAt },
    { id: 'game', label: '所属游戏', value: detail.gameName },
  ]
  const accountInfo = [...baseInfo, ...presentation.tradeInfo, ...presentation.extraInfo]
  const evidenceImages = detail.evidenceImages ?? detail.gallery
  const galleryItems = evidenceImages.map((src, index) => ({
    src, alt: `${detail.gameName}商品实拍 ${index + 1}`,
    label: ['皮肤墙', '英雄墙', '战绩'][index] ?? `实拍 ${index + 1}`,
    source: '验号截图',
    date: presentation.specimen ? '08-03 提交' : '',
    description: `可左右滑动查看全部 ${evidenceImages.length} 张实拍，以验号报告为准。`,
  }))
  const actionBar = <ProductActionBar favorite={favorite} onFavorite={toggleFavorite} onConsult={openSupport} onPurchase={openPurchase} purchaseDisabled={!canPurchase(detail)} purchaseLabel={isLinkedDataMode ? '购买未接入' : detail.status === 'sold' ? '已售出' : detail.status === 'reserved' ? '交易中' : detail.status === 'off_shelf' ? '已下架' : '立即购买'} />

  return <main className="product-detail-page detail-draft5" data-node-id="3681:22777">
    <ProductDetailHeader compact={compact} price={detail.price} gameName={detail.gameName} sellerSummary={sellerSummary} onBack={back} onShare={share} onOpenSeller={() => setSellerOpen(true)} />
    <div className="product-detail-scroll" ref={scrollRef} onScroll={onScroll}>
      <section className="detail-overview">
        <div className="detail-price"><strong>¥{detail.price.toLocaleString('zh-CN')}</strong></div>
        {detail.status !== 'on_sale' && <StatusBadge tone={detail.status === 'reserved' ? 'warning' : detail.status === 'off_shelf' ? 'danger' : 'neutral'}>{detail.status === 'reserved' ? '交易中' : detail.status === 'sold' ? '已售出' : '已下架'}</StatusBadge>}
        {isLinkedDataMode ? <DetailTitleIdentity detail={detail} /> : <div className="detail-game-identity"><img src={presentation.specimen ? asset('game-wzry.png') : detail.gameIcon} alt="" /><Heading variant="page">{detail.gameName}</Heading></div>}
        <MetricGrid className="detail-core-metrics" label="账号核心指标" items={[...presentation.verificationSummary, ...presentation.metrics]} variant="emphasis" valueSize="compact" columns={3} />
        <SellerSummary ref={sellerSummaryRef} className="detail-summary" text={sellerSummary} maxLines={2} onOpen={() => setSellerOpen(true)} />
      </section>
      <section className="detail-shots">
        <SectionHeader className="detail-shots-heading" title="账号实拍" badge={<StatusBadge tone="success">已验号</StatusBadge>} />
        {galleryItems.length ? <div>{galleryItems.slice(0, 3).map((item, index) => <button type="button" key={`${item.src}-${index}`} onClick={() => setGalleryIndex(index)} aria-label={`预览商品图片 ${index + 1}`}><img src={item.src} alt={item.alt} loading="lazy" /><small>{item.label}</small></button>)}{galleryItems.length > 3 && <button type="button" className="detail-more-shots" onClick={() => setGalleryIndex(3)} aria-label={`查看全部 ${galleryItems.length} 张商品图片`}><b>+{galleryItems.length - 3}</b><small>共{galleryItems.length}张</small></button>}</div> : <EmptyStateView compact title="暂无商品实拍" />}
      </section>
      <Tabs className="detail-tabs" label="商品详情分区" variant="underline" size="lg" items={tabs.map(([value, label]) => ({ value, label, panelId: `detail-section-${value}` }))} value={activeSection} onValueChange={value => goToSection(value as SectionId)} />
      <div className="detail-sections">
        {activeSection === 'assets' && <section className="detail-section detail-assets-panel" id="detail-section-assets" data-detail-section="assets" role="tabpanel" aria-label="资产内容"><AssetInventory key={detail.id} detail={detail} linked={isLinkedDataMode} onRowCountChange={setAssetRows} /></section>}
        {activeSection === 'description' && <section className="detail-section detail-description-panel" id="detail-section-description" data-detail-section="description" role="tabpanel" aria-label="描述内容">
          <SectionHeader className="detail-content-heading detail-account-heading" title="账号信息" />
          {isLinkedDataMode ? <><InfoList items={baseInfo} /><LinkedCurrentDetailCard view={linkedDetailView} /><LinkedSubmissionSnapshot snapshot={detail.linkedPublishSnapshot} /></> : <>
            <div id="detail-account-properties"><InfoList items={accountInfo} onHint={(_, hint) => setInfoHint(hint)} /></div>
          </>}
        </section>}
        {activeSection === 'guarantee' && <section className="detail-section detail-guarantee-panel" id="detail-section-guarantee" data-detail-section="guarantee" role="tabpanel" aria-label="保障内容">
          <SectionHeader className="detail-content-heading" title="平台保障范围" action={<button type="button" onClick={() => setRulesOpen(true)}>保障规则 <ChevronRight size={13} aria-hidden="true" /></button>} />
          <div className="detail-guarantee-grid"><div><b><Check size={13} aria-hidden="true" /> 平台保障</b>{(presentation.specimen ? ['平台担保交易', '品质服务', '描述不符退款', '找回包赔'] : detail.guaranteeCovered).map(item => <span key={item}>{item}</span>)}</div></div>
          <Heading className="detail-process-title">交易流程</Heading>
          <ol className="detail-process" aria-label="交易流程">{process.map(item => <li className="done" key={item}>{item}</li>)}</ol>
          <p className="detail-guarantee-note">{isLinkedDataMode ? '具体服务范围以平台公示规则为准。' : '换绑完成后系统自动确认收货并向卖家放款。'}</p>
        </section>}
      </div>
    </div>
    {actionBar}
    <GuestLoginFloatingBar />
    {showAssetBackToTop(activeSection, assetRows, pastTabTop) && <IconButton className="detail-back-top" label="返回资产页签顶部" onClick={returnToTabTop}><ArrowUp size={20} aria-hidden="true" /></IconButton>}
    <ImagePreview open={galleryIndex !== null} index={galleryIndex ?? 0} items={galleryItems} onClose={closeGallery} onIndexChange={setGalleryIndex} onShare={share} />
    <BottomSheet open={sellerOpen} onClose={() => setSellerOpen(false)} title="卖家补充" subtitle="卖家描述" className="detail-seller-sheet">
      <div className="detail-seller-copy">{presentation.sellerDescription.map(line => <p key={line}>{line}</p>)}<span><UserRound size={14} aria-hidden="true" />{presentation.sellerByline}</span></div>
      <p className="detail-source-note"><Info size={13} aria-hidden="true" /><span>以上由卖家自行填写，不属于平台验号结论。与验号报告不一致时以<strong>验号报告</strong>为准。</span></p>
    </BottomSheet>
    <Dialog open={Boolean(infoHint)} title="交易属性说明" onClose={() => setInfoHint('')} actions={<Button fullWidth onClick={() => setInfoHint('')}>知道了</Button>}>{infoHint}</Dialog>
    <BottomSheet open={purchaseOpen} title="确认购买" onClose={closePurchase} className="detail-purchase-sheet" actions={<Button fullWidth onClick={confirmPurchase} disabled={!canPurchase(detail)}>{standardConfirmed ? '再次确认标准版' : `确认购买 · ¥${getPurchaseAmount(detail.price, packageType).toLocaleString('zh-CN')}`}</Button>}>
      <div className="purchase-options"><p>请选择交易保障方案</p>
        <button type="button" className={packageType === 'PREMIUM' ? 'selected' : ''} aria-pressed={packageType === 'PREMIUM'} onClick={() => { setPackageType('PREMIUM'); setStandardConfirmed(false) }}><span><b>包赔版</b><small>包含找回包赔服务</small></span><strong>¥{getPurchaseAmount(detail.price, 'PREMIUM').toLocaleString('zh-CN')}</strong></button>
        <button type="button" className={packageType === 'STANDARD' ? 'selected' : ''} aria-pressed={packageType === 'STANDARD'} onClick={() => { setPackageType('STANDARD'); setStandardConfirmed(false) }}><span><b>标准版</b><small>不包含找回包赔，需二次确认</small></span><strong>¥{getPurchaseAmount(detail.price, 'STANDARD').toLocaleString('zh-CN')}</strong></button>
        {standardConfirmed && <p className="purchase-warning" role="alert">标准版不含找回包赔服务，请再次确认。</p>}
      </div>
    </BottomSheet>
    <GuaranteeRulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
    <Toast message={toast} onDismiss={() => setToast('')} />
  </main>
}

export function OrderPreviewPage() {
  const [params] = useSearchParams()
  const detail = productDetailRepository.getById(params.get('goodsId') ?? '')
  const packageType = params.get('packageType') === 'STANDARD' ? 'STANDARD' : 'PREMIUM'
  return <main className="product-detail-page order-preview-page"><DesignPromptTrigger nodeId="orders:preview" /><section><span>订单预览</span>{detail ? <><Heading variant="result">{detail.gameName} · {detail.productCode}</Heading><p>{packageType === 'PREMIUM' ? '包赔版' : '标准版'} · ¥{getPurchaseAmount(detail.price, packageType).toLocaleString('zh-CN')}</p><small>本地演示已进入确认页，不会发起真实支付。</small><Link to={`/goods/${detail.id}`}>返回商品详情</Link></> : <><Heading variant="result">商品不存在</Heading><Link to="/game?gameCode=wzry">返回商品列表</Link></>}</section></main>
}
