import { useMemo, useState } from 'react'
import { ArrowLeft, Clock3 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import '../styles/footprint-draft3.css'

type FootprintGame = 'all' | 'wzry' | 'hpjy'

const footprintItems = [
  { id: '1', day: '今天', time: '09:36', game: 'wzry' as const, title: '王者50★ 108英雄 312皮肤 倪克斯神谕', price: '¥1,280', decrease: '120', image: 'assets/footprint-v3/wzry.png' },
  { id: 'hpjy-1', day: '今天', time: '09:12', game: 'hpjy' as const, title: '和平精英 微信区 满级', price: '¥860', image: 'assets/footprint-v3/hpjy.png' },
  { id: 'ys-1', day: '08-19', game: 'ys' as const, title: '原神 亚服 五星6', price: '¥1,420', status: '已售出', image: 'assets/footprint-v3/genshin.png' },
]

const tabs = [
  { value: 'all' as const, label: '全部', count: 15 },
  { value: 'wzry' as const, label: '王者荣耀', count: 12 },
  { value: 'hpjy' as const, label: '和平精英', count: 3 },
]

function FootprintStatusBar() {
  return <div className="footprint-d3-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
}

export function FootprintPage() {
  const navigate = useNavigate()
  const [game, setGame] = useState<FootprintGame>('all')
  const [cleared, setCleared] = useState(false)
  const visible = useMemo(() => cleared ? [] : footprintItems.filter((item) => game === 'all' || item.game === game), [cleared, game])
  const groups = useMemo(() => visible.reduce<Record<string, typeof footprintItems>>((result, item) => {
    ;(result[item.day] ??= []).push(item)
    return result
  }, {}), [visible])

  return <main className="footprint-d3-page">
    <header className="footprint-d3-header">
      <FootprintStatusBar />
      <div className="footprint-d3-topbar"><button type="button" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft size={20} /></button><h1>足迹</h1><button type="button" disabled={cleared} onClick={() => setCleared(true)}>清空</button></div>
    </header>
    <div className="footprint-d3-scroll">
      {!cleared && <nav className="footprint-d3-tabs" aria-label="按游戏筛选浏览足迹">{tabs.map((tab) => <button type="button" key={tab.value} className={game === tab.value ? 'active' : ''} aria-pressed={game === tab.value} onClick={() => setGame(tab.value)}>{tab.label} <small>{tab.count}</small></button>)}</nav>}
      {visible.length ? Object.entries(groups).map(([day, items]) => <section className="footprint-d3-day" key={day}><h2>{day}</h2><div>{items.map((item) => <Link className={item.status ? 'sold' : ''} to={`/goods/${item.id}`} key={item.id}><img src={assetPath(item.image)} alt="" /><span><b>{item.title}</b><span className="footprint-d3-meta"><strong>{item.price}</strong>{item.decrease && <em>↓ <small>{item.decrease}</small></em>}</span></span>{item.status ? <i>{item.status}</i> : <time>{item.time}</time>}</Link>)}</div></section>) : <section className="footprint-d3-empty"><span><Clock3 size={25} /></span><h2>{cleared ? '浏览足迹已清空' : '这个游戏还没有足迹'}</h2><p>{cleared ? '之后浏览过的商品会重新出现在这里。' : '去看看喜欢的账号吧。'}</p><Link to="/buy/list">去逛逛</Link></section>}
    </div>
  </main>
}
