import { useState, type CSSProperties } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp, Diamond, Headphones, Share2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { assetPath } from '../assetPath'
import { Button, Dialog, ImagePreview } from '../ui'
import type { ProductDetail } from '../../types/productDetail'
import './mobile-account-showcase.css'

// Presentation-only inventory transcribed from this product's existing p07.jpg.
// Each crop points to the original artwork, not the earlier mock's example account.
const skinGroups = [
  { name: '荣耀典藏', tone: 'gold', items: [
    ['孙悟空', '全息碎影', 1, 0], ['武则天', '倪克斯神谕', 2, 0],
    ['夏侯惇', '无限飓风号', 3, 0], ['小乔', '天鹅之梦', 4, 0],
    ['孙尚香', '杀手不太冷', 5, 0], ['鲁班七号', '星空梦想', 6, 0],
    ['关羽', '赤影疾锋', 0, 1], ['虞姬', '神鉴启示录', 1, 1], ['瑶', '拾光映像', 2, 1],
  ] },
  { name: '无双限定', tone: 'purple', items: [
    ['公孙离', '离恨烟', 3, 1], ['韩信', '群星魔术团', 4, 1],
    ['小乔', '时之魔女', 5, 1], ['瑶', '真我赫兹', 6, 1],
  ] },
  { name: '其他精选', tone: 'blue', items: [
    ['妲己', '青丘·九尾', 0, 2], ['伽罗', '太华', 1, 2], ['刘备', '时之恋人', 2, 2],
    ['武则天', '海洋之心', 3, 2], ['孙悟空', '幽冥火', 4, 2],
    ['宫本武藏', '幽冥之眼', 5, 2], ['貂蝉', '仲夏夜之梦', 6, 2],
  ] },
] as const

export function MobileAccountShowcase({ detail }: { detail: ProductDetail }) {
  const navigate = useNavigate()
  const [active, setActive] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const group = skinGroups[active]
  const code = detail.title.match(/^【([^】]+)】/)?.[1] ?? detail.productCode
  const source = detail.gallery[0]
  const metrics = [
    ['商品编号', code], ['大区', detail.platform], ['当前段位', detail.rank],
    ['贵族等级', detail.eliteLevel ?? '—'], ['英雄数量', String(detail.heroCount)], ['皮肤数量', String(detail.skinCount)],
  ]
  const chips = [
    ['荣耀典藏', detail.title.match(/荣耀典藏数量(\d+)/)?.[1], 'gold'],
    ['传说', detail.title.match(/传说皮肤数量(\d+)/)?.[1], 'orange'],
    ['史诗', detail.title.match(/史诗皮肤数量(\d+)/)?.[1], 'purple'],
    ['可议价', '', 'blue'],
  ]
  return <main className="account-showcase" aria-label="精品账号详情">
    <header className="account-showcase__nav">
      <button type="button" aria-label="返回商品列表" onClick={() => navigate('/game?gameCode=wzry')}><ArrowLeft size={22} /></button>
      <strong>商品详情</strong>
      <button type="button" aria-label="分享商品" onClick={() => setNotice('分享样式预览，本轮未接入分享功能。')}><Share2 size={21} /></button>
    </header>
    <div className="account-showcase__scroll">
      <section className="account-showcase__overview" aria-label="账号概览">
        <div className="account-showcase__brand">
          <img src={assetPath('assets/messages-draft3/support-mascot.png')} alt="深度玩家" />
          <div><strong>深度玩家</strong><small>一亿玩家的账号交易平台</small></div>
        </div>
        <div className="account-showcase__hero">
          <h1>王者荣耀 · 精品账号</h1>
          <div><p>高价值皮肤资产 · 专属客服安心交易</p><strong><small>售价</small><span>¥{detail.price.toLocaleString('zh-CN')}</span></strong></div>
        </div>
        <dl className="account-showcase__metrics">{metrics.map(([label, value]) => <div key={label}><dd>{value}</dd><dt>{label}</dt></div>)}</dl>
        <div className="account-showcase__chips" aria-label="账号亮点">{chips.map(([label, value, tone]) => <span className={`account-showcase__chip account-showcase__chip--${tone}`} key={label}>{label}{value && <b>{value}</b>}</span>)}</div>
      </section>
      <div className="account-showcase__tabs" role="tablist" aria-label="皮肤分类">{skinGroups.map((item, index) => <button
        type="button" role="tab" id={`showcase-tab-${index}`} key={item.name} aria-selected={active === index}
        aria-controls="showcase-skins" tabIndex={active === index ? 0 : -1}
        onClick={() => { setActive(index); setExpanded(false) }}
        onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % skinGroups.length : event.key === 'ArrowLeft' ? (index + skinGroups.length - 1) % skinGroups.length : event.key === 'Home' ? 0 : event.key === 'End' ? skinGroups.length - 1 : null
          if (next !== null) { event.preventDefault(); setActive(next); setExpanded(false); document.getElementById(`showcase-tab-${next}`)?.focus() }
        }}
      >{item.name}<small>{item.items.length}</small></button>)}</div>
      <section className={`account-showcase__inventory account-showcase__inventory--${group.tone}`} id="showcase-skins" role="tabpanel" aria-labelledby={`showcase-tab-${active}`}>
        <div className="account-showcase__section-title"><h2><Diamond size={15} fill="currentColor" />{group.name}</h2><button type="button" onClick={() => setPreviewOpen(true)}>查看商品原图</button></div>
        <div className="account-showcase__grid">{group.items.slice(0, expanded ? undefined : 6).map(([hero, skin, column, row]) => {
          const style = { '--art-x': `${-(416 + column * 192) / 168 * 100}%`, '--art-y': `${-(65 + row * 292) / 238 * 100}%` } as CSSProperties
          return <button type="button" className="account-showcase__skin" key={skin} onClick={() => setPreviewOpen(true)} aria-label={`查看${hero}·${skin}商品原图`}>
            <span className="account-showcase__art" style={style}><img src={source} alt={`${hero}·${skin}`} /></span>
            <span className="account-showcase__rarity">{active === 2 ? '精选' : group.name}</span>
            <span className="account-showcase__skin-caption"><b>{hero}</b><span>{skin}</span></span>
          </button>
        })}</div>
        {group.items.length > 6 && <button className="account-showcase__expand" type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? '收起' : `展开全部 ${group.items.length} 款`}{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>}
        <p className="account-showcase__source">展示商品原图中的精选皮肤，完整资产请查看原图。</p>
      </section>
      <section className="account-showcase__info" aria-label="账号信息"><h2>账号信息</h2><dl><div><dt>实名状态</dt><dd>{detail.realName}</dd></div><div><dt>二次实名</dt><dd>{detail.secondRealName ? '支持' : '不支持'}</dd></div><div><dt>商品编号</dt><dd>{code}</dd></div></dl><p>购买前请核对账号资料，具体信息以验号结果为准。</p></section>
    </div>
    <footer className="account-showcase__actions">
      <button type="button" onClick={() => setNotice('客服入口样式预览，本轮未接入客服会话。')}><Headphones size={18} />联系客服</button>
      <button type="button" onClick={() => setNotice('购买按钮样式预览，不会创建订单或发起支付。')}>立即购买</button>
    </footer>
    <ImagePreview open={previewOpen} onClose={() => setPreviewOpen(false)} items={[{ src: source, alt: `${code}商品原图`, description: '商品原有展示图片' }]} index={0} onIndexChange={() => undefined} />
    <Dialog open={Boolean(notice)} title="本地样式预览" onClose={() => setNotice('')} actions={<Button fullWidth onClick={() => setNotice('')}>知道了</Button>}>{notice}</Dialog>
  </main>
}
