import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { useAuthPrompt, useAuthStatus } from '../components/AuthAccess'
import { assetPath } from '../components/assetPath'
import { buildLoginRoute } from '../components/authModel'
import { coCreationServices, homeGames, principles, recentGames, tradeFeatures } from '../data/homeData'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import '../styles/home-draft3.css'

const asset = (name: string) => assetPath(`assets/home-v2/${name}`)
const draft3Asset = (name: string) => assetPath(`assets/home-draft3/${name}`)

function SectionHeading({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <header className="home-v2-section-heading">
      <div><b>{number}</b><h2>{title}</h2></div>
      <p>{subtitle}</p>
    </header>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { requireAuth } = useAuthPrompt()
  const authenticated = useAuthStatus()
  const currentPath = `${location.pathname}${location.search}${location.hash}`
  const showFootprints = recentGames.length > 0 && new URLSearchParams(location.search).get('footprints') !== 'empty'
  const openZone = (code: string) => navigate(`/game?gameCode=${code}`)
  const openProtected = (returnTo: string, title: string, description: string) => {
    if (requireAuth({ title, description, returnTo })) navigate(returnTo)
  }

  useEffect(() => {
    if (location.hash !== '#game-selection') return undefined
    const frame = window.requestAnimationFrame(() => document.getElementById('game-selection')?.scrollIntoView({ block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [location.hash])

  return (
    <main className="home-v2">
      <header className="home-v2-top">
        <div className="home-v2-status" aria-hidden="true">
          <time>9:41</time>
          <span aria-hidden="true">
            <img src={asset('status-signal.svg')} alt="" />
            <img src={asset('status-wifi.svg')} alt="" />
            <img src={asset('status-battery.svg')} alt="" />
          </span>
        </div>
        <div className="home-v2-brand-row">
          <div className="home-v2-brand-lockup"><img src={draft3Asset('brand-mark.svg')} alt="" /><strong>玩家自己的游戏交易平台</strong></div>
          <button type="button" aria-label="联系客服" onClick={() => openProtected(SUPPORT_CONVERSATION_ROUTE, '登录后联系客服', '登录后可查看客服回复并继续咨询。')}><img src={asset('customer-service.svg')} alt="" /></button>
        </div>
        <button className="home-v2-search" type="button" onClick={() => navigate('/search')}>
          <img src={asset('search.svg')} alt="" /><span>王者 108英雄 王者段位 500-1500</span>
        </button>
      </header>

      <section id="game-selection" className={`home-v2-discovery${showFootprints ? '' : ' home-v2-discovery--empty'}`} aria-label="选择游戏">
        {showFootprints && <>
          <div className="home-v2-block-title"><h2>最近看过</h2><button type="button" onClick={() => openProtected('/footprints', '登录后查看足迹', '登录后可同步并查看你的完整浏览足迹。')}>全部足迹<img src={asset('arrow-right.svg')} alt="" /></button></div>
          <div className="home-v2-recent">
            {recentGames.map((game) => <button type="button" key={game.name} onClick={() => openZone(game.code)}><img src={game.image} alt="" /><span><strong>{game.name}</strong><small>{game.footprint}{game.reducedText && <> <b>{game.reducedText}</b></>}</small></span></button>)}
          </div>
        </>}
        <div className="home-v2-block-title home-v2-hot-title"><h2>热门游戏</h2><button type="button" onClick={() => document.getElementById('game-selection')?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>全部游戏<img src={asset('arrow-right.svg')} alt="" /></button></div>
        <div className="home-v2-games">
          {homeGames.map((game, index) => <button type="button" key={`${game.code}-${index}`} onClick={() => openZone(game.code)}><img src={game.image} alt="" /><span>{game.name}</span></button>)}
        </div>
        <button className="home-v2-inquiry" type="button" onClick={() => openProtected('/sell', '登录后继续卖号', '发布商品、快速回收和查看报价需要登录账号。')}><span><strong>不想等买家？<em>直接卖给回收商</em></strong><small>多家回收商报价，先询价再决定</small></span><b>立即询价</b></button>
      </section>

      <section className="home-v2-about">
        <div className="home-v2-about-divider"><span>关于深度玩家</span></div>
        <div className="home-v2-manifesto">
          <small>DeepGamer</small>
          <h1>属于玩家<br />自己的<span>交易平台</span></h1>
          <p>我们也是玩家。<br />因为受够了一些不合理的游戏交易体验，所以决定自己<br />做一个。</p>
          <div className="home-v2-manifesto-foot"><div><i /><span>玩家不是用户，<br />是共建者。</span></div><figure className="home-v2-manifesto-mascot"><img src={draft3Asset('manifesto-mascot.png')} alt="深度玩家羊驼形象" /></figure></div>
        </div>

        <section className="home-v2-story home-v2-principles">
          <SectionHeading number="01" title="为什么做深度玩家" subtitle="我们也是玩家，所以知道玩家最烦什么。" />
          <div className="home-v2-principle-list">{principles.map((item) => <article key={item.title}><h3><i />{item.title}</h3><p>{item.detail}</p></article>)}</div>
        </section>

        <section className="home-v2-story home-v2-features">
          <SectionHeading number="02" title="交易，本来可以更爽一点" subtitle="少一点套路，多一点站在玩家这边。" />
          <div className="home-v2-feature-grid">{tradeFeatures.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.detail}</p></article>)}</div>
        </section>

        <section className="home-v2-story home-v2-wishes">
          <SectionHeading number="03" title="你负责许愿，我们负责实现" subtitle="游戏交易世界里的「阿拉丁神灯」。" />
          <article className="home-v2-feedback"><div className="home-v2-feedback-copy"><h3>吐槽广场</h3><p>你觉得哪里难用？客服哪里让你不爽？<br />想要什么新功能？直接说。</p></div><div className="home-v2-small-mascot" aria-hidden="true"><img src={draft3Asset('feedback-mascot.png')} alt="" /></div><button type="button" onClick={() => navigate('/feedback')}>去吐槽</button><small>不满意？羊驼已经准备好替你吐口水了。</small></article>
          <div className="home-v2-services">{coCreationServices.map((item) => <button type="button" key={item.title} onClick={() => navigate('/feedback')}><span><strong>{item.title}</strong><small>{item.detail}</small></span><img src={asset('service-arrow.svg')} alt="" /></button>)}</div>
        </section>

        <footer className="home-v2-closing"><p>我们来自玩家，<br />依靠玩家，<br />也为了玩家。</p><i /><strong>每一个人，<br />都可以成为深度玩家。</strong></footer>
      </section>
      <div className="home-v2-nav-spacer" aria-hidden="true" />
      {!authenticated && <aside className={`home-draft3-login-bar guest-login-bar-home${showFootprints ? ' home-draft3-login-bar--dark' : ''}`}>
        <span className="home-draft3-gift" aria-hidden="true"><i>¥</i></span>
        <strong>人人都是深度玩家，登陆领取更多优惠</strong>
        <button type="button" onClick={() => navigate(buildLoginRoute('one_tap', currentPath, currentPath))}>登录</button>
      </aside>}
      <BottomNav variant="home" showGuestPrompt={false} />
    </main>
  )
}
