import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { LoginFloatingBar } from '../components/LoginFloatingBar'
import { Button, Heading, StatusBar } from '../components/ui'
import { useAuthPrompt, useAuthStatus } from '../components/AuthAccess'
import { assetPath } from '../components/assetPath'
import { buildLoginRoute } from '../components/authModel'
import { coCreationServices, homeGames, principles, recentGames, tradeFeatures } from '../data/homeData'
import { SUPPORT_RECOMMENDATION_ROUTE } from '../data/messageFixtures'
import { isLinkedDataMode } from '../runtime/dataMode'
import { toCatalogGame, useLinkedState } from '../linked/linkedData'
import '../styles/home-draft3.css'

const asset = (name: string) => assetPath(`assets/home-v2/${name}`)
const draft3Asset = (name: string) => assetPath(`assets/home-draft3/${name}`)

function SectionHeading({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <header className="home-v2-section-heading">
      <div><b>{number}</b><Heading as="h2" variant="section">{title}</Heading></div>
      <p>{subtitle}</p>
    </header>
  )
}

export function HomePage() {
  const linkedState = useLinkedState()
  const navigate = useNavigate()
  const location = useLocation()
  const { requireAuth } = useAuthPrompt()
  const authenticated = useAuthStatus()
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloadMessage, setDownloadMessage] = useState('')
  const [followOpen, setFollowOpen] = useState(false)
  const [followMessage, setFollowMessage] = useState('')
  const followDialogRef = useRef<HTMLElement>(null)
  const followTriggerRef = useRef<HTMLButtonElement | null>(null)
  const pageContentRef = useRef<HTMLDivElement>(null)
  const currentPath = `${location.pathname}${location.search}${location.hash}`
  const linkedHomeGames = isLinkedDataMode ? (linkedState?.games ?? []).filter((game) => game.status === 'ACTIVE').sort((a, b) => a.sortOrder - b.sortOrder).map((game) => toCatalogGame(game)) : homeGames
  const showFootprints = authenticated && !isLinkedDataMode && recentGames.length > 0 && new URLSearchParams(location.search).get('footprints') !== 'empty'
  const openZone = (code: string) => navigate(`/game?gameCode=${code}`)
  const openProtected = (returnTo: string, title: string, description: string) => {
    if (requireAuth({ title, description, returnTo })) navigate(returnTo)
  }
  const openFollow = (event: MouseEvent<HTMLButtonElement>) => {
    followTriggerRef.current = event.currentTarget
    setFollowMessage('')
    setFollowOpen(true)
  }

  useEffect(() => {
    if (!downloadMessage) return undefined
    const timer = window.setTimeout(() => setDownloadMessage(''), 2500)
    return () => window.clearTimeout(timer)
  }, [downloadMessage])

  useEffect(() => {
    if (location.hash !== '#game-selection') return undefined
    const frame = window.requestAnimationFrame(() => document.getElementById('game-selection')?.scrollIntoView({ block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash])

  useEffect(() => {
    if (!followOpen) return undefined
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const content = pageContentRef.current
    content?.setAttribute('inert', '')
    const frame = requestAnimationFrame(() => followDialogRef.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }))
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setFollowOpen(false); return }
      if (event.key !== 'Tab' || !followDialogRef.current) return
      const items = [...followDialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex]:not([tabindex="-1"])')]
      if (!items.length) return
      const first = items[0]; const last = items.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', close)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = oldOverflow
      content?.removeAttribute('inert')
      window.removeEventListener('keydown', close)
      followTriggerRef.current?.focus({ preventScroll: true })
    }
  }, [followOpen])

  return (
    <main className="home-v2">
      <div ref={pageContentRef} style={{ display: 'contents' }} aria-hidden={followOpen || undefined}>
      <header className={`home-v2-top${downloadOpen ? ' home-v2-top--download' : ''}`}>
        <StatusBar className="home-v2-status" />
        {downloadOpen && <aside id="home-app-download" className="home-draft3-download" aria-label="APP下载引导" data-node-id="4128:1506">
          <img src={draft3Asset('download-brand.svg')} alt="" />
          <strong>深度玩家APP体验更好</strong>
          <button type="button" onClick={() => setDownloadMessage('APP下载地址暂未开放，请继续使用网页版')}>立即下载</button>
          {downloadMessage && <span className="home-draft3-download-message" role="status">{downloadMessage}</span>}
        </aside>}
        <div className="home-v2-brand-row">
          <button type="button" className="home-draft3-brand-button" aria-label="深度玩家，显示或收起APP下载引导" aria-expanded={downloadOpen} aria-controls="home-app-download" onClick={() => { setDownloadOpen((value) => !value); setDownloadMessage('') }}><img src={draft3Asset('brand-mark.svg')} alt="" /><span><b>深度玩家</b><strong>玩家自己的游戏交易平台</strong></span></button>
          <button type="button" aria-label="联系客服" onClick={() => openProtected(SUPPORT_RECOMMENDATION_ROUTE, '登录后联系客服', '登录后可查看客服回复并继续咨询。')}><img src={asset('customer-service.svg')} alt="" /></button>
        </div>
        <button className="home-v2-search" type="button" onClick={() => navigate('/search')}>
          <img src={asset('search.svg')} alt="" /><span>王者 108英雄 王者段位 500-1500</span>
        </button>
      </header>

      <section id="game-selection" className={`home-v2-discovery${showFootprints ? '' : ' home-v2-discovery--empty'}`} aria-label="选择游戏">
        {showFootprints && <>
          <div className="home-v2-block-title"><Heading as="h2" variant="section">最近看过</Heading><button type="button" onClick={() => openProtected('/footprints', '登录后查看足迹', '登录后可同步并查看你的完整浏览足迹。')}>全部足迹<img src={asset('arrow-right.svg')} alt="" /></button></div>
          <div className="home-v2-recent">
            {recentGames.map((game) => <button type="button" key={game.name} onClick={() => openZone(game.code)}><img src={game.image} alt="" /><span><strong>{game.name}</strong><small>{game.footprint}</small></span></button>)}
          </div>
        </>}
        <div className="home-v2-block-title home-v2-hot-title"><Heading as="h2" variant="section">热门游戏</Heading><button type="button" onClick={() => navigate('/game/select?current=wzry')}>全部游戏<img src={asset('arrow-right.svg')} alt="" /></button></div>
        <div className="home-v2-games">
          {linkedHomeGames.map((game, index) => <button type="button" key={`${game.code}-${index}`} onClick={() => openZone(game.code)}><img src={game.image} alt="" /><span>{game.name}</span></button>)}
        </div>
        <button className="home-v2-inquiry" type="button" onClick={() => openProtected('/sell', '登录后继续卖号', '发布商品、快速回收和查看报价需要登录账号。')}><span><strong>不想等买家？<em>直接卖给回收商</em></strong><small>多家回收商报价，先询价再决定</small></span><b>立即询价</b></button>
      </section>

      <section className="home-v2-about">
        <div className="home-v2-about-divider"><span>关于深度玩家</span></div>
        <div className="home-v2-manifesto">
          <small>DeepGamer</small>
          <Heading variant="hero">属于玩家<br />自己的<span>交易平台</span></Heading>
          <p>我们也是玩家。<br />因为受够了一些不合理的游戏交易体验，所以决定自己<br />做一个。</p>
          <div className="home-v2-manifesto-foot"><div><i /><span>玩家不是用户，<br />是共建者。</span></div><figure className="home-v2-manifesto-mascot"><img src={draft3Asset('manifesto-mascot.png')} alt="深度玩家羊驼形象" /></figure></div>
        </div>

        <section className="home-v2-story home-v2-principles">
          <SectionHeading number="01" title="为什么做深度玩家" subtitle="我们也是玩家，所以知道玩家最烦什么。" />
          <div className="home-v2-principle-list">{principles.map((item) => <article key={item.title}><Heading as="h3" variant="subsection"><i />{item.title}</Heading><p>{item.detail}</p></article>)}</div>
        </section>

        <section className="home-v2-story home-v2-features">
          <SectionHeading number="02" title="交易，本来可以更爽一点" subtitle="少一点套路，多一点站在玩家这边。" />
          <div className="home-v2-feature-grid">{tradeFeatures.map((item) => <article key={item.title}><Heading as="h3" variant="subsection">{item.title}</Heading><p>{item.detail}</p></article>)}</div>
        </section>

        <section className="home-v2-story home-v2-wishes">
          <SectionHeading number="03" title="你负责许愿，我们负责实现" subtitle="游戏交易世界里的「阿拉丁神灯」。" />
          <article className="home-v2-feedback">
            <div className="home-v2-feedback-copy"><Heading as="h3" variant="subsection">吐槽广场</Heading><p>你觉得哪里难用？客服哪里让你不爽？<br />想要什么新功能？直接说。</p></div>
            <div className="home-v2-small-mascot" aria-hidden="true"><img src={draft3Asset('feedback-mascot.png')} alt="" /></div>
            <footer className="home-v2-feedback-actions">
              <Button variant="secondary" size="sm" className="home-draft3-feedback-trigger" aria-label="吐槽广场，去吐槽" aria-haspopup="dialog" onClick={openFollow}>去吐槽</Button>
              <small>不满意？羊驼已经准备好替你吐口水了。</small>
            </footer>
          </article>
          <div className="home-v2-services">{coCreationServices.map((item) => <button type="button" key={item.title} aria-haspopup="dialog" onClick={openFollow}><span><strong>{item.title}</strong><small>{item.detail}</small></span><img src={asset('service-arrow.svg')} alt="" /></button>)}</div>
        </section>

        <footer className="home-v2-closing"><p>我们来自玩家，<br />依靠玩家，<br />也为了玩家。</p><i /><strong>每一个人，<br />都可以成为深度玩家。</strong></footer>
      </section>
      <div className="home-v2-nav-spacer" aria-hidden="true" />
      {!authenticated && <LoginFloatingBar onLogin={() => navigate(buildLoginRoute('one_tap', currentPath, currentPath))} />}
      <BottomNav variant="home" showGuestPrompt={false} />
      </div>
      {followOpen && <div className="home-draft3-follow-layer"><button type="button" className="home-draft3-follow-mask" aria-label="关闭关注提示" tabIndex={-1} onClick={() => setFollowOpen(false)} /><section ref={followDialogRef} role="dialog" aria-modal="true" aria-labelledby="home-follow-title" aria-describedby="home-follow-description" data-node-id="4047:7125"><button type="button" className="home-draft3-follow-close" aria-label="关闭" onClick={() => setFollowOpen(false)}><img src={draft3Asset('follow-close.svg')} alt="" /></button><Heading id="home-follow-title" as="h2" variant="dialog">关注「深度玩家」微信服务号</Heading><p id="home-follow-description">开启微信交易通知，重要进度及时掌握</p><div className="home-draft3-qr-placeholder" aria-label="公众号二维码占位"><div><img src={draft3Asset('follow-qr-placeholder.svg')} alt="" /><small>公众号二维码占位</small></div></div><small>请截图保存二维码，再打开微信扫一扫，从相册识别并关注</small><button type="button" className="home-draft3-save-qr" onClick={() => setFollowMessage('当前为设计稿二维码占位，暂不可保存')}>保存二维码到相册</button>{followMessage && <span className="home-draft3-follow-message" role="status">{followMessage}</span>}</section></div>}
    </main>
  )
}
