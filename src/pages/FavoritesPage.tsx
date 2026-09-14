import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FavoriteCard } from '../components/FavoriteCard'
import { clearSelectionForFilter, emptyFavoriteFilters, filterFavorites, projectFavorite, toggleAllVisible, toggleFavoriteSelection } from '../components/favoritesModel'
import { favoriteRepository } from '../repository/favoriteRepository'
import type { FavoriteFilters, FavoriteRecord } from '../types/favorite'
import { Button, ChoiceChip, Dialog, EmptyStateView, FilterTrigger, IconButton, PageHeader, SearchField, StatusBar, Toast } from '../components/ui'
import '../styles/favorites.css'

type Panel = 'game' | 'status' | 'time' | null
type Option = { value: string; label: string }
const statusOptions: Option[] = [{ value: 'all', label: '全部' }, { value: 'on_sale', label: '售卖中' }, { value: 'trading', label: '交易中' }, { value: 'sold', label: '已售出' }, { value: 'off_shelf', label: '已下架' }]
const timeOptions: Option[] = [{ value: 'all', label: '全部' }, { value: '7d', label: '最近7天' }, { value: '30d', label: '最近30天' }]

function getLabel(options: Option[], value: string, fallback: string) { return options.find((option) => option.value === value)?.label ?? fallback }

export function FavoritesPage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const initialManage = new URLSearchParams(search).get('scenario') === 'manage'
  const [records, setRecords] = useState<FavoriteRecord[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [filters, setFilters] = useState<FavoriteFilters>(emptyFavoriteFilters)
  const [searchDraft, setSearchDraft] = useState('')
  const [query, setQuery] = useState('')
  const [panel, setPanel] = useState<Panel>(null)
  const [draft, setDraft] = useState('all')
  const [managing, setManaging] = useState(initialManage)
  const [dropsOnly, setDropsOnly] = useState(false)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')
  const listRef = useRef<HTMLElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const initializedPreview = useRef(false)
  const triggerRefs = useRef<Record<Exclude<Panel, null>, HTMLButtonElement | null>>({ game: null, status: null, time: null })

  const sync = useCallback(() => {
    try { setRecords(favoriteRepository.list()); setLoadError('') } catch { setLoadError('收藏加载失败，请重试') }
    setLoaded(true)
  }, [])
  useEffect(() => { sync(); return favoriteRepository.subscribe(sync) }, [sync])

  const views = useMemo(() => records.map(projectFavorite), [records])
  const gameOptions = useMemo<Option[]>(() => [{ value: 'all', label: '全部游戏' }, ...[...new Map(views.filter((view) => view.gameCode !== 'unknown').map((view) => [view.gameCode, view.gameName])).entries()].map(([value, label]) => ({ value, label }))], [views])
  const filtered = useMemo(() => filterFavorites(records, filters, Date.now(), query), [filters, query, records])
  const dropIds = useMemo(() => new Set(views.filter((item) => item.priceDrop > 0).map((item) => item.productId)), [views])
  const visible = useMemo(() => dropsOnly ? filtered.filter((item) => dropIds.has(item.productId)) : filtered, [dropIds, dropsOnly, filtered])
  const visibleIds = visible.map((item) => item.productId)

  useEffect(() => {
    if (!initialManage || initializedPreview.current || !visibleIds.length) return
    initializedPreview.current = true
    setSelection(new Set([visibleIds[0]]))
  }, [initialManage, visibleIds])

  useEffect(() => {
    if (managing && visible.length === 0) { setManaging(false); setSelection(new Set()) }
  }, [managing, visible.length])
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (panel) { list.setAttribute('inert', ''); list.setAttribute('aria-hidden', 'true') }
    else { list.removeAttribute('inert'); list.removeAttribute('aria-hidden') }
  }, [panel])
  useEffect(() => {
    if (!panel) return undefined
    const previous = triggerRefs.current[panel]
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLButtonElement>('.selected, .favorite-filter-option')?.focus())
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setPanel(null); return }
      if (event.key !== 'Tab') return
      const items = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
      if (!items.length) return
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus() }
    }
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', keydown); requestAnimationFrame(() => previous?.focus()) }
  }, [panel])

  const closeDelete = useCallback(() => { if (!deleting) setConfirmDelete(false) }, [deleting])

  const back = () => {
    if (managing) { setManaging(false); setSelection(new Set()); return }
    window.history.length > 1 ? navigate(-1) : navigate('/profile')
  }
  const toggleManage = () => { setPanel(null); setManaging((value) => !value); setSelection(new Set()) }
  const openPanel = (next: Exclude<Panel, null>) => {
    if (managing) return
    if (panel === next) { setPanel(null); return }
    setDraft(next === 'game' ? filters.gameCode : next === 'status' ? filters.status : filters.time)
    setPanel(next)
  }
  const resetDraft = () => setDraft('all')
  const applyDraft = () => {
    if (!panel) return
    setFilters((current) => ({ ...current, [panel === 'game' ? 'gameCode' : panel]: draft }))
    setSelection(clearSelectionForFilter())
    setPanel(null)
  }
  const submitSearch = () => { setQuery(searchDraft.trim()); setSelection(new Set()); setPanel(null) }
  const clearFilters = () => { setFilters(emptyFavoriteFilters); setSearchDraft(''); setQuery(''); setSelection(new Set()) }
  const deleteSelected = () => {
    if (!selection.size || deleting) return
    setDeleting(true)
    const count = selection.size
    const ok = favoriteRepository.removeMany([...selection])
    setDeleting(false)
    if (!ok) { setDeleteError('删除失败，请重试'); return }
    setDeleteError(''); setConfirmDelete(false); setSelection(new Set()); setToast(`已取消 ${count} 件收藏`)
    if (records.length - count <= 0) setManaging(false)
  }
  const panelOptions = panel === 'game' ? gameOptions : panel === 'status' ? statusOptions : timeOptions

  const cleanSold = () => {
    const sold = views.filter((item) => item.status === 'sold').map((item) => item.productId)
    if (!sold.length) { setToast('暂无已售出收藏'); return }
    setSelection(new Set(sold)); setDeleteError(''); setConfirmDelete(true)
  }

  return <main className={`favorites-page ${managing ? 'is-managing' : ''}`} data-node-id={managing ? '3681:36255' : '3681:36166'}>
    <header className="favorites-header">
      <StatusBar />
      <PageHeader className="favorites-titlebar" title={managing ? '管理收藏' : '收藏'} left={managing ? <Button variant="ghost" size="md" onClick={() => setSelection((current) => toggleAllVisible(current, visibleIds))}>全选</Button> : <IconButton label="返回" onClick={back}><ArrowLeft size={20} strokeWidth={2} aria-hidden="true" /></IconButton>} right={<Button variant="ghost" size="md" onClick={toggleManage} disabled={!records.length}>{managing ? '完成' : '管理'}</Button>} />
      <form className="favorites-search" role="search" onSubmit={(event) => event.preventDefault()}>
        <SearchField className="favorites-search-field" value={searchDraft} maxLength={50} disabled={managing} onChange={(event) => setSearchDraft(event.target.value)} onClear={!managing ? () => setSearchDraft('') : undefined} onSearch={submitSearch} clearLabel="清空搜索" placeholder="搜索商品、游戏或商品编号" aria-label="搜索收藏" />
      </form>
      <section className="favorites-filters" aria-label="筛选收藏">
        <FilterTrigger ref={(node) => { triggerRefs.current.game = node }} active={filters.gameCode !== 'all'} disabled={managing} aria-haspopup="dialog" expanded={panel === 'game'} aria-controls="favorite-filter-panel" onClick={() => openPanel('game')}>{filters.gameCode === 'all' ? '选择游戏' : getLabel(gameOptions, filters.gameCode, '选择游戏')}</FilterTrigger>
        <FilterTrigger ref={(node) => { triggerRefs.current.status = node }} active={filters.status !== 'all'} disabled={managing} aria-haspopup="dialog" expanded={panel === 'status'} aria-controls="favorite-filter-panel" onClick={() => openPanel('status')}>{filters.status === 'all' ? '商品状态' : getLabel(statusOptions, filters.status, '商品状态')}</FilterTrigger>
        <FilterTrigger ref={(node) => { triggerRefs.current.time = node }} active={filters.time !== 'all'} emphasized disabled={managing} aria-haspopup="dialog" expanded={panel === 'time'} aria-controls="favorite-filter-panel" onClick={() => openPanel('time')}>{filters.time === 'all' ? '收藏时间' : getLabel(timeOptions, filters.time, '收藏时间')}</FilterTrigger>
      </section>
    </header>

    <section ref={listRef} className="favorites-list" aria-label="收藏商品列表">
      {managing && visible.length > 0 && <><div className="favorites-manage-summary">已选 <b>{selection.size}</b> 个 · 可移除或整理到分组</div></>}
      {loaded && !loadError && records.length > 0 && !managing && <div className="favorites-summary"><span>共 <b>{records.length}</b> 个收藏{dropIds.size > 0 && <> · <em>{dropIds.size} 个降价</em></>}</span><button type="button" className={dropsOnly ? 'active' : ''} aria-pressed={dropsOnly} onClick={() => setDropsOnly((value) => !value)}>只看降价</button></div>}
      {!loaded ? <div className="favorites-state"><span className="favorites-loading" aria-label="正在加载" /></div>
        : loadError ? <EmptyStateView className="favorites-state" title="收藏加载失败" description={loadError} action={<Button size="md" shape="pill" onClick={sync}>重试</Button>} />
          : visible.length ? visible.map((item) => <FavoriteCard key={item.productId} item={item} managing={managing} selected={selection.has(item.productId)} onToggle={() => setSelection((current) => toggleFavoriteSelection(current, item.productId))} />)
            : records.length === 0 ? <EmptyStateView className="favorites-state" title="还没有收藏商品" description="遇到喜欢的账号，点收藏就能在这里找到。" action={<Button size="md" shape="pill" onClick={() => navigate('/game?gameCode=wzry')}>去逛逛</Button>} />
              : <EmptyStateView className="favorites-state" title="没有符合条件的收藏" description="换个关键词或筛选条件再看看。" action={<Button size="md" shape="pill" onClick={clearFilters}>清空搜索与筛选</Button>} />}
    </section>

    {panel && <div className="favorite-filter-layer"><button type="button" className="favorite-filter-mask" aria-label="关闭筛选" onClick={() => setPanel(null)} /><section id="favorite-filter-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label={`${panel === 'game' ? '游戏' : panel === 'status' ? '商品状态' : '收藏时间'}筛选`}><div>{panelOptions.map((option) => <ChoiceChip className={`favorite-filter-option ${draft === option.value ? 'selected' : ''}`} selected={draft === option.value} showCheck key={option.value} onClick={() => setDraft(option.value)}>{option.label}</ChoiceChip>)}</div><footer><Button variant="ghost" size="lg" onClick={resetDraft}>重置</Button><Button size="lg" shape="pill" onClick={applyDraft}>确定</Button></footer></section></div>}

    {managing && visible.length > 0 && <><aside className="favorites-manage-note">管理态只处理「取消收藏」与「清理已售出」，不提供批量下载或改价。</aside><footer className="favorites-manage-bar"><button type="button" onClick={cleanSold}>清理已售出</button><button type="button" className="delete" disabled={!selection.size} onClick={() => { setDeleteError(''); setConfirmDelete(true) }}><Trash2 size={15} aria-hidden="true" />取消收藏（{selection.size}）</button></footer></>}

    <Dialog open={confirmDelete} onClose={closeDelete} title="取消收藏" showClose={false} closeOnBackdrop={!deleting} actions={<><Button variant="outline" size="md" shape="pill" onClick={closeDelete} disabled={deleting}>返回</Button><Button variant="danger" size="md" shape="pill" onClick={deleteSelected} loading={deleting}>确认取消</Button></>}><p>确认取消所选 {selection.size} 件收藏？不会影响商品和订单。</p>{deleteError && <small role="alert">{deleteError}</small>}</Dialog>
    <Toast message={toast} onDismiss={() => setToast('')} />
  </main>
}
