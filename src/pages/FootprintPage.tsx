import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { createFootprintItems, defaultFootprintFilters, filterFootprintItems, formatFootprintTime, type FootprintFilters } from '../components/footprintModel'
import { Button, ChoiceChip, Dialog, EmptyStateView, FilterTrigger, IconButton, PageHeader, SearchField, StatusBadge } from '../components/ui'
import { DesignPromptTrigger } from '../components/DesignPromptTrigger'
import '../styles/favorites.css'
import '../styles/footprint-draft3.css'

type Panel = 'game' | 'status' | 'time'
type Option = { value: string; label: string }
const statusOptions: Option[] = [{ value: 'all', label: '全部' }, { value: 'selling', label: '售卖中' }, { value: 'trading', label: '交易中' }, { value: 'sold', label: '已售出' }, { value: 'off_shelf', label: '已下架' }]
export const footprintTimeOptions: Option[] = [{ value: 'last3days', label: '最近3天' }, { value: 'days3to7', label: '3天到7天' }, { value: 'before7days', label: '7天以前' }]
const panelLabels: Record<Panel, string> = { game: '选择游戏', status: '商品状态', time: '浏览时间' }
const icon = (name: string) => assetPath(`assets/footprint-v3/${name}.svg`)
const statusTones = { selling: 'success', trading: 'warning', sold: 'neutral', off_shelf: 'danger' } as const

export function FootprintPage() {
  const navigate = useNavigate()
  const [records, setRecords] = useState(() => createFootprintItems())
  const [filters, setFilters] = useState<FootprintFilters>({ ...defaultFootprintFilters })
  const [searchDraft, setSearchDraft] = useState('')
  const [panel, setPanel] = useState<Panel | null>(null)
  const [draft, setDraft] = useState('all')
  const [confirmClear, setConfirmClear] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const triggers = useRef<Record<Panel, HTMLButtonElement | null>>({ game: null, status: null, time: null })
  const gameOptions = useMemo<Option[]>(() => [{ value: 'all', label: '全部游戏' }, ...[...new Map(records.map((item) => [item.game, item.gameName])).entries()].map(([value, label]) => ({ value, label }))], [records])
  const visible = useMemo(() => filterFootprintItems(records, filters), [records, filters])
  const options = panel === 'game' ? gameOptions : panel === 'status' ? statusOptions : footprintTimeOptions
  const clearFilters = () => { setFilters({ ...defaultFootprintFilters }); setSearchDraft(''); setPanel(null) }
  const submitSearch = () => { setFilters((current) => ({ ...current, query: searchDraft.trim() })); setPanel(null) }
  const openPanel = (next: Panel) => { setDraft(filters[next]); setPanel((value) => value === next ? null : next) }
  const applyFilter = () => {
    if (!panel || (draft !== 'all' && !options.some((option) => option.value === draft))) return
    setFilters((current) => ({ ...current, [panel]: draft }))
    setPanel(null)
  }

  useEffect(() => { listRef.current?.scrollTo({ top: 0 }) }, [filters])
  useEffect(() => {
    const list = listRef.current
    list?.toggleAttribute('inert', !!panel)
    if (!panel) return undefined
    const previous = triggers.current[panel]
    const element = panelRef.current
    const frame = requestAnimationFrame(() => {
      const initial = panelRef.current?.querySelector<HTMLButtonElement>('.selected') ?? panelRef.current?.querySelector<HTMLButtonElement>('.favorite-filter-option')
      initial?.focus({ preventScroll: true })
    })
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setPanel(null) } }
    window.addEventListener('keydown', close)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', close)
      list?.removeAttribute('inert')
      if (document.activeElement === document.body || element?.contains(document.activeElement)) previous?.focus({ preventScroll: true })
    }
  }, [panel])
  return <main className="footprint-d3-page" data-node-id="3681:28771">
    <div className="footprint-d3-content">
    <header className="footprint-d3-header">
      <DesignPromptTrigger nodeId="3681:28771" />
      <PageHeader className="footprint-d3-topbar" title="足迹" left={<IconButton label="返回" onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')}><img src={icon('back')} alt="" /></IconButton>} right={<Button variant="ghost" size="sm" disabled={!records.length} onClick={() => { setPanel(null); setConfirmClear(true) }}>清空</Button>} />
      <form className="footprint-d3-search" role="search" onSubmit={(event) => { event.preventDefault(); setPanel(null); searchRef.current?.blur() }} data-node-id="4087:169">
        <SearchField ref={searchRef} className="footprint-d3-search-field" value={searchDraft} maxLength={100} enterKeyHint="search" autoComplete="off" onFocus={() => setPanel(null)} onChange={(event) => setSearchDraft(event.target.value)} onClear={() => { setSearchDraft(''); searchRef.current?.focus() }} onSearch={submitSearch} clearLabel="清空搜索" placeholder="搜索商品、游戏或商品编号" aria-label="搜索商品、游戏或商品编号" />
      </form>
      <nav className="footprint-d3-filters" aria-label="筛选浏览足迹" data-node-id="4087:175">
        {(['game', 'status', 'time'] as const).map((key) => {
          const choices = key === 'game' ? gameOptions : key === 'status' ? statusOptions : footprintTimeOptions
          const label = filters[key] === 'all' ? panelLabels[key] : choices.find((option) => option.value === filters[key])?.label ?? panelLabels[key]
          return <FilterTrigger ref={(node) => { triggers.current[key] = node }} key={key} active={filters[key] !== 'all'} emphasized={key === 'time'} aria-label={`${panelLabels[key]}：${label}`} aria-haspopup="dialog" expanded={panel === key} aria-controls="footprint-filter-panel" onClick={() => openPanel(key)}>{label}</FilterTrigger>
        })}
      </nav>
    </header>
    <div className="footprint-d3-body">
    <div ref={listRef} className="footprint-d3-scroll" aria-label="浏览足迹列表" aria-hidden={!!panel || undefined}>
      <span className="footprint-d3-sr-only" role="status">共 {visible.length} 条浏览足迹</span>
      {visible.length ? <ul className="footprint-d3-list">{visible.map((item) => <li key={item.id}>
        <Link className={`footprint-d3-card${item.status === 'sold' || item.status === 'off_shelf' ? ' sold' : ''}`} to={`/goods/${item.id}`}>
          <img src={assetPath(item.image)} alt="" />
          <span className="footprint-d3-card-copy">
            <b title={item.title}>{item.title}</b>
            <span className="footprint-d3-meta"><strong>¥{item.price.toLocaleString('zh-CN')}</strong><StatusBadge className="footprint-d3-item-status" tone={statusTones[item.status]}>{statusOptions.find((option) => option.value === item.status)?.label}</StatusBadge></span>
            <time dateTime={new Date(item.viewedAt).toISOString()} aria-label={`浏览时间 ${formatFootprintTime(item.viewedAt)}`}>{formatFootprintTime(item.viewedAt)}</time>
          </span>
        </Link>
      </li>)}</ul> : <EmptyStateView className="footprint-d3-empty" icon={<Clock3 size={25} aria-hidden="true" />} title={!records.length ? '浏览足迹已清空' : '没有符合条件的足迹'} description={!records.length ? '去看看喜欢的账号吧。' : '换个关键词或筛选条件再看看。'} action={records.length ? <Button size="md" shape="pill" onClick={clearFilters}>清空搜索与筛选</Button> : <Button size="md" shape="pill" onClick={() => navigate('/game?gameCode=wzry')}>去逛逛</Button>} />}
    </div>
    {panel && <div className="favorite-filter-layer footprint-d3-filter-layer"><button type="button" className="favorite-filter-mask" aria-label="关闭筛选" tabIndex={-1} onClick={() => setPanel(null)} /><section id="footprint-filter-panel" ref={panelRef} role="dialog" aria-modal="false" aria-label={`${panelLabels[panel]}筛选`}><div>{options.map((option) => <ChoiceChip className={`favorite-filter-option${draft === option.value ? ' selected' : ''}`} selected={draft === option.value} showCheck key={option.value} onClick={() => setDraft(option.value)}>{option.label}</ChoiceChip>)}</div><footer><Button variant="ghost" size="lg" onClick={() => setDraft('all')}>重置</Button><Button size="lg" shape="pill" onClick={applyFilter}>确定</Button></footer></section></div>}
    </div>
    </div>
    <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} title="清空浏览足迹" showClose={false} actions={<><Button variant="outline" size="md" shape="pill" onClick={() => setConfirmClear(false)}>取消</Button><Button variant="danger" size="md" shape="pill" onClick={() => { setRecords([]); clearFilters(); setConfirmClear(false) }}>确认清空</Button></>}><p>确认清空全部 {records.length} 条浏览足迹？不会影响收藏、商品和订单。</p></Dialog>
  </main>
}
