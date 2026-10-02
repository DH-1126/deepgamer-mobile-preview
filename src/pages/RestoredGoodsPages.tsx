import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { ArrowLeft, ImagePlus, PackageOpen, RefreshCw, Store } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ActionBar, Button, Heading, IconButton, PageHeader, SelectField, TextAreaField, TextField } from '../components/ui'
import { useRestoredClient } from '../linked/RestoredClientProvider'
import { RestoredHttpError } from '../linked/restoredLinkedTransport'
import {
  createRestoredGoodsApi,
  createRestoredGoodsPersistence,
  createRestoredOperationKey,
  restoredGoodsContentFingerprint,
  type RestoredCreateGoodsDraftInput,
  type RestoredOwnedGoods,
  type RestoredPublicGame,
} from '../linked/restoredGoodsApi'
import { uploadRestoredMedia, type RestoredMedia } from '../linked/restoredMedia'
import { useRestoredSeller } from '../linked/useRestoredSeller'
import { RestoredPublishDynamicFields } from '../linked/RestoredPublishDynamicFields'
import {
  collectRestoredGoodsFields,
  validateRestoredPublishSubmission,
  type RestoredPublishDirectoryField,
  type RestoredPublishFieldValue,
  type RestoredPublishForm,
} from '../linked/restoredPublish'
import '../styles/restored-goods.css'

const auditLabels: Record<RestoredOwnedGoods['auditStatus'], string> = {
  NOT_SUBMITTED: '未提交', PENDING: '审核中', APPROVED: '审核通过', REJECTED: '审核拒绝', NEEDS_MORE_INFO: '待补充资料',
}
const productLabels: Record<RestoredOwnedGoods['productStatus'], string> = { ON_SALE: '在售', OFF_SHELF: '已下架', SOLD: '已售出' }

function message(error: unknown) {
  return error instanceof Error ? error.message : '本地商品操作失败，请重试'
}

function unknownMessage(error: unknown) {
  return error instanceof RestoredHttpError && error.outcome === 'UNKNOWN'
    ? `${error.message}。已保留本次固定操作键，请使用原操作重试，不要新建重复商品。`
    : message(error)
}

type RestoredAttemptKind = 'create' | 'edit'
type RestoredAttemptOutcome = 'SUCCESS' | 'FAILED' | 'UNKNOWN'

export function createRestoredAttemptKeys(factory: (kind: RestoredAttemptKind) => string = kind => createRestoredOperationKey(kind)) {
  const keys = new Map<string, string>()
  const identity = (kind: RestoredAttemptKind, fingerprint: string) => `${kind}:${fingerprint}`
  return {
    acquire(kind: RestoredAttemptKind, fingerprint: string) {
      const id = identity(kind, fingerprint)
      const key = keys.get(id) ?? factory(kind)
      keys.set(id, key)
      return key
    },
    settle(kind: RestoredAttemptKind, fingerprint: string, outcome: RestoredAttemptOutcome) {
      if (outcome !== 'UNKNOWN') keys.delete(identity(kind, fingerprint))
    },
  }
}

export function createRestoredSubmissionKeys(factory: () => string = () => createRestoredOperationKey('submit')) {
  const keys = new Map<string, string>()
  const identity = (goodsId: string, contentRevision: number) => `${goodsId}:${contentRevision}`
  return {
    acquire(goodsId: string, contentRevision: number) {
      const id = identity(goodsId, contentRevision)
      const key = keys.get(id) ?? factory()
      keys.set(id, key)
      return key
    },
    succeeded(goodsId: string, contentRevision: number) { keys.delete(identity(goodsId, contentRevision)) },
  }
}

export function isRestoredGoodsWriteBlocked(state: {
  loading: boolean
  busy: boolean
  sellerCanPublish: boolean
  sellerError: string | null
  workingCanEdit: boolean
}) {
  return state.loading || state.busy || !state.sellerCanPublish || Boolean(state.sellerError) || !state.workingCanEdit
}

export function createRestoredPollBackoff() {
  let failures = 0
  return {
    current: () => Math.min(30_000, 5_000 * 2 ** Math.max(0, failures - 1)),
    failed: () => { failures += 1 },
    succeeded: () => { failures = 0 },
  }
}

export function parseRestoredPriceFen(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/u.test(value)) return null
  const [yuan, decimal = ''] = value.split('.')
  const result = Number(yuan) * 100 + Number(decimal.padEnd(2, '0'))
  return Number.isSafeInteger(result) && result > 0 ? result : null
}

function GoodsHeader({ title }: { title: string }) {
  const navigate = useNavigate()
  return <PageHeader className="restored-goods-header" title={title} left={<IconButton label="返回" onClick={() => navigate(-1)}><ArrowLeft size={21} /></IconButton>} />
}

function RestoredOffShelfAction({ item, confirming, busy, onConfirm, onCancel }: {
  item: RestoredOwnedGoods
  confirming: boolean
  busy: boolean
  onConfirm: (goods: RestoredOwnedGoods) => void
  onCancel: () => void
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const previous = useRef(confirming)
  const restoreTrigger = useRef(false)
  useEffect(() => {
    if (confirming && !previous.current) cancel.current?.focus()
    if (!confirming && previous.current && restoreTrigger.current) trigger.current?.focus()
    previous.current = confirming
    if (!confirming) restoreTrigger.current = false
  }, [confirming])
  if (confirming) return <span className="restored-goods-confirm">
    <button type="button" disabled={busy} onClick={() => onConfirm(item)}>{busy ? '下架中…' : '确认下架'}</button>
    <button ref={cancel} type="button" disabled={busy} onClick={() => { restoreTrigger.current = true; onCancel() }}>取消</button>
  </span>
  return <button ref={trigger} data-restored-goods-off-shelf-trigger="true" type="button" disabled={busy} onClick={() => onConfirm(item)}>下架</button>
}

export function RestoredGoodsListView({ goods, loading, staleError, busyId, confirmId, focusGoodsId = '', onConfirm, onCancelConfirm, onFocusRestored, onReload }: {
  goods: RestoredOwnedGoods[]
  loading: boolean
  staleError: string | null
  busyId: string
  confirmId: string
  focusGoodsId?: string
  onConfirm: (goods: RestoredOwnedGoods) => void
  onCancelConfirm: () => void
  onFocusRestored?: () => void
  onReload?: () => void
}) {
  const cards = useRef(new Map<string, HTMLElement>())
  useEffect(() => {
    if (!focusGoodsId) return
    const card = cards.current.get(focusGoodsId)
    if (!card) return
    const primary = card.querySelector<HTMLElement>('[data-restored-goods-primary-action="true"], [data-restored-goods-off-shelf-trigger="true"]')
    ;(primary ?? card).focus()
    onFocusRestored?.()
  }, [focusGoodsId, goods, onFocusRestored])
  return <div className="restored-goods-scroll restored-goods-list">
    <aside className="restored-goods-notice">本页只显示当前本地演示主体的商品；后台审核或上下架后，可见时 10 秒内刷新。</aside>
    {staleError ? <span className="restored-goods-new is-disabled" aria-disabled="true">刷新成功后可发布新商品</span> : <Link className="restored-goods-new" to="/publish">发布新商品</Link>}
    {staleError && <section className="restored-goods-stale" role="alert"><p>{staleError}</p>{onReload && <button type="button" onClick={onReload}><RefreshCw size={15} />立即重试</button>}</section>}
    {loading && !goods.length && <p className="restored-goods-loading" role="status">正在加载本人商品…</p>}
    {!loading && !goods.length && !staleError && <section className="restored-goods-empty"><PackageOpen size={30} /><Heading as="h2" variant="result">还没有商品草稿</Heading><p>卖家审核通过并完成本地演示签署后，可以发布第一件商品。</p></section>}
    {goods.map(item => <article key={item.id} tabIndex={-1} ref={node => { if (node) cards.current.set(item.id, node); else cards.current.delete(item.id) }}>
      <div className="restored-goods-card-image">{item.cover ? <img src={item.cover.contentUrl} alt="" /> : item.images[0] ? <img src={item.images[0].contentUrl} alt="" /> : <PackageOpen size={26} />}</div>
      <div className="restored-goods-card-copy"><header><span>{auditLabels[item.auditStatus]}</span><em>{productLabels[item.productStatus]}</em></header>
        <Heading as="h2" variant="subsection">{item.title}</Heading><p><b>¥{(item.priceFen / 100).toFixed(2)}</b> · {item.goodsNo}</p>
        {item.currentAudit?.reviewReason && <small>审核说明：{item.currentAudit.reviewReason}</small>}
        {item.capabilities.disabledReason && <small>{item.capabilities.disabledReason}</small>}
        <footer>
          {item.auditStatus === 'APPROVED' && item.productStatus === 'ON_SALE' && <span className="restored-goods-unavailable">公开详情待接入</span>}
          {!staleError && item.capabilities.canEdit && <Link data-restored-goods-primary-action="true" to={`/publish?goodsId=${encodeURIComponent(item.id)}`}>编辑并重新送审</Link>}
          {!staleError && item.capabilities.canOffShelf && <RestoredOffShelfAction item={item} confirming={confirmId === item.id} busy={Boolean(busyId)} onConfirm={onConfirm} onCancel={onCancelConfirm} />}
        </footer>
      </div>
    </article>)}
  </div>
}

export function RestoredGoodsListPage() {
  const { status, transport, error: connectionError, reconnect } = useRestoredClient()
  const api = useMemo(() => transport ? createRestoredGoodsApi(transport) : null, [transport])
  const [goods, setGoods] = useState<RestoredOwnedGoods[]>([])
  const [loading, setLoading] = useState(true)
  const [staleError, setStaleError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState('')
  const [confirmId, setConfirmId] = useState('')
  const [focusGoodsId, setFocusGoodsId] = useState('')
  const generation = useRef(0)
  const pollBackoff = useRef(createRestoredPollBackoff())
  const offShelfKeys = useRef(new Map<string, string>())

  const load = useCallback(async (background = false) => {
    if (!api) return
    const current = ++generation.current
    if (!background || !goods.length) setLoading(true)
    try {
      const next = await api.listAll()
      if (current !== generation.current) return
      setGoods(next); setStaleError(null); pollBackoff.current.succeeded()
    } catch (caught) {
      if (current !== generation.current) return
      setStaleError(goods.length ? `刷新失败，当前显示上次数据（可能已过期）：${message(caught)}` : message(caught))
      pollBackoff.current.failed()
    } finally { if (current === generation.current) setLoading(false) }
  }, [api, goods.length])

  useEffect(() => { if (api) void load(); else setLoading(status === 'loading') }, [api, load, status])
  useEffect(() => {
    if (!api) return undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let active = true
    const schedule = () => { clearTimeout(timer); if (active && document.visibilityState === 'visible') timer = setTimeout(async () => { await load(true); schedule() }, pollBackoff.current.current()) }
    const visible = () => { clearTimeout(timer); if (document.visibilityState === 'visible') { void load(true).then(schedule) } }
    schedule(); document.addEventListener('visibilitychange', visible)
    return () => { active = false; clearTimeout(timer); document.removeEventListener('visibilitychange', visible); generation.current++ }
  }, [api, load, staleError])

  const confirm = async (item: RestoredOwnedGoods) => {
    if (confirmId !== item.id) return setConfirmId(item.id)
    if (!api || busyId) return
    setBusyId(item.id); setStaleError(null)
    const key = offShelfKeys.current.get(item.id) ?? createRestoredOperationKey('off-shelf')
    offShelfKeys.current.set(item.id, key)
    try {
      await api.offShelf(item.id, { rowVersion: item.rowVersion, reason: '卖家在用户端主动下架' }, key)
      offShelfKeys.current.delete(item.id); await load(); setConfirmId(''); setFocusGoodsId(item.id)
    } catch (caught) { setStaleError(unknownMessage(caught)) } finally { setBusyId('') }
  }

  if (status !== 'ready' || !transport) return <main className="restored-goods-page"><GoodsHeader title="我的商品" /><section className="restored-goods-connection"><Store size={25} /><Heading as="h2" variant="result">{status === 'error' ? '本地联动未连接' : '正在连接本地联动'}</Heading>{connectionError && <p role="alert">{connectionError}</p>}{status === 'error' && <Button onClick={reconnect}>重新连接</Button>}</section></main>
  return <main className="restored-goods-page"><GoodsHeader title="我的商品" /><RestoredGoodsListView goods={goods} loading={loading} staleError={staleError} busyId={busyId} confirmId={confirmId} focusGoodsId={focusGoodsId} onConfirm={item => { void confirm(item) }} onCancelConfirm={() => setConfirmId('')} onFocusRestored={() => setFocusGoodsId('')} onReload={() => { void load() }} /></main>
}

type PendingMedia = { file: File; key: string }
type MediaChoice = { mediaId: string; contentUrl: string; name: string }

function tags(value: string) {
  return [...new Set(value.split(/[,，\n]/u).map(item => item.trim()).filter(Boolean))]
}

export function coreFieldKind(field: RestoredPublishDirectoryField) {
  if (field.sourceType !== 'GOODS_FIELD') return null
  const key = field.sourceKey.toLowerCase()
  if (['title', 'goods_title'].includes(key)) return 'title'
  if (['description', 'goods_description'].includes(key)) return 'description'
  if (['price', 'price_fen'].includes(key)) return 'price'
  if (['cover', 'cover_image', 'cover_image_url'].includes(key)) return 'cover'
  if (['images', 'image_urls', 'goods_images'].includes(key)) return 'images'
  return null
}

function hasCore(form: RestoredPublishForm, kind: ReturnType<typeof coreFieldKind>) {
  return Object.values(form.fields).some(field => coreFieldKind(field) === kind)
}

export function RestoredGoodsPublishPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const goodsId = params.get('goodsId')
  const { status, transport, error: connectionError, reconnect } = useRestoredClient()
  const sellerState = useRestoredSeller()
  const api = useMemo(() => transport ? createRestoredGoodsApi(transport) : null, [transport])
  const [games, setGames] = useState<RestoredPublicGame[]>([])
  const [gameCode, setGameCode] = useState('')
  const [form, setForm] = useState<RestoredPublishForm | null>(null)
  const [values, setValues] = useState<Record<string, RestoredPublishFieldValue>>({})
  const [activeStep, setActiveStep] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [highlightTags, setHighlightTags] = useState('')
  const [serviceTags, setServiceTags] = useState('')
  const [media, setMedia] = useState<MediaChoice[]>([])
  const [coverId, setCoverId] = useState<string | null>(null)
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([])
  const [working, setWorking] = useState<RestoredOwnedGoods | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'save' | 'submit' | ''>('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const [savedThisSession, setSavedThisSession] = useState(false)
  const persistence = useRef<ReturnType<typeof createRestoredGoodsPersistence> | null>(null)
  const draftAttempts = useRef(createRestoredAttemptKeys())
  const submitAttempts = useRef(createRestoredSubmissionKeys())
  const blocked = isRestoredGoodsWriteBlocked({
    loading,
    busy: Boolean(busy),
    sellerCanPublish: Boolean(sellerState.seller?.canPublish),
    sellerError: sellerState.error,
    workingCanEdit: working ? working.capabilities.canEdit : true,
  })

  const markDirty = () => { setDirty(true); setSavedThisSession(false); setError(''); setNotice('') }
  const hydrate = useCallback((nextForm: RestoredPublishForm, item: RestoredOwnedGoods | null) => {
    const next: Record<string, RestoredPublishFieldValue> = {}
    for (const field of Object.values(nextForm.fields)) {
      const kind = coreFieldKind(field)
      if (kind === 'title') next[field.fieldId] = item?.title
      else if (kind === 'description') next[field.fieldId] = item?.description
      else if (kind === 'price') next[field.fieldId] = item?.priceFen
      else if (kind === 'cover') next[field.fieldId] = item?.cover?.mediaId
      else if (kind === 'images') next[field.fieldId] = item?.images.map(image => image.mediaId)
      else {
        const saved = item?.fields.find(savedField => savedField.refType === field.sourceType && savedField.refKey === field.sourceKey)
        if (saved) next[field.fieldId] = saved.value as RestoredPublishFieldValue
      }
    }
    setValues(next)
  }, [])

  useEffect(() => {
    if (!api) { setLoading(status === 'loading'); return undefined }
    const abort = new AbortController()
    let active = true
    setLoading(true); setError('')
    void (async () => {
      try {
        const [availableGames, item] = await Promise.all([api.listGames(abort.signal), goodsId ? api.read(goodsId, abort.signal) : Promise.resolve(null)])
        if (!active) return
        const selected = item?.game.code ?? availableGames[0]?.code
        if (!selected) throw new Error('暂无可发布商品的游戏')
        const nextForm = await api.readPublishForm(selected, abort.signal)
        if (!active) return
        setGames(availableGames); setGameCode(selected); setForm(nextForm); setWorking(item); persistence.current = createRestoredGoodsPersistence(api, item)
        setTitle(item?.title ?? ''); setDescription(item?.description ?? ''); setPrice(item ? (item.priceFen / 100).toFixed(2) : '')
        setHighlightTags(item?.highlightTags.join('，') ?? ''); setServiceTags(item?.servicePromiseTags.join('，') ?? '')
        const choices = [...(item?.cover ? [{ ...item.cover, name: '已保存封面' }] : []), ...(item?.images.map((image, index) => ({ ...image, name: `已保存图片 ${index + 1}` })) ?? [])]
        setMedia(choices); setCoverId(item?.cover?.mediaId ?? null); setPendingMedia([]); hydrate(nextForm, item); setActiveStep(0); setDirty(false); setSavedThisSession(false)
      } catch (caught) { if (active) setError(message(caught)) } finally { if (active) setLoading(false) }
    })()
    return () => { active = false; abort.abort() }
  }, [api, goodsId, hydrate, status])

  const changeGame = async (next: string) => {
    if (!api || working || next === gameCode) return
    setLoading(true); setError('')
    try { const nextForm = await api.readPublishForm(next); setGameCode(next); setForm(nextForm); setValues({}); setActiveStep(0); markDirty() }
    catch (caught) { setError(message(caught)) } finally { setLoading(false) }
  }

  const chooseMedia = (event: ChangeEvent<HTMLInputElement>) => {
    if (blocked) return
    const selected = [...(event.target.files ?? [])]
    event.target.value = ''
    if (selected.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024)) return setError('商品图片仅支持 5MB 以内的 JPG、PNG 或 WEBP')
    if (media.length + pendingMedia.length + selected.length > 20) return setError('商品图片最多 20 张')
    setPendingMedia(current => [...current, ...selected.map(file => ({ file, key: createRestoredOperationKey('media') }))]); markDirty()
  }

  const renderMediaField = (field: RestoredPublishDirectoryField): ReactNode => <div className="restored-goods-media-control">
    <label><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={blocked} onChange={chooseMedia} /><ImagePlus size={22} /><b>选择商品图片</b><small>单张最大 5MB，共最多 20 张</small></label>
    {(media.length > 0 || pendingMedia.length > 0) && <ul>{media.map(item => <li key={item.mediaId}><span>{item.name}{coverId === item.mediaId ? '（封面）' : ''}</span><span>{coreFieldKind(field) === 'cover' && coverId !== item.mediaId && <button type="button" onClick={() => { setCoverId(item.mediaId); markDirty() }}>设为封面</button>}<button type="button" onClick={() => { setMedia(current => current.filter(choice => choice.mediaId !== item.mediaId)); if (coverId === item.mediaId) setCoverId(null); markDirty() }}>移除</button></span></li>)}{pendingMedia.map(item => <li key={item.key}><span>{item.file.name}（待上传）</span><button type="button" onClick={() => { setPendingMedia(current => current.filter(choice => choice.key !== item.key)); markDirty() }}>移除</button></li>)}</ul>}
  </div>

  const dynamicValues = useMemo(() => {
    if (!form) return values
    const next = { ...values }
    for (const field of Object.values(form.fields)) {
      const kind = coreFieldKind(field)
      if (kind === 'title') next[field.fieldId] = title || undefined
      else if (kind === 'description') next[field.fieldId] = description || undefined
      else if (kind === 'price') next[field.fieldId] = parseRestoredPriceFen(price) ?? undefined
      else if (kind === 'cover') next[field.fieldId] = coverId ?? pendingMedia[0]?.key
      else if (kind === 'images') next[field.fieldId] = [...media.filter(item => item.mediaId !== coverId).map(item => item.mediaId), ...pendingMedia.map(item => item.key)]
    }
    return next
  }, [coverId, description, form, media, pendingMedia, price, title, values])

  const changeDynamic = (next: Record<string, RestoredPublishFieldValue>) => {
    if (!form) return
    for (const field of Object.values(form.fields)) {
      const kind = coreFieldKind(field), value = next[field.fieldId]
      if (kind === 'title') setTitle(typeof value === 'string' ? value : '')
      else if (kind === 'description') setDescription(typeof value === 'string' ? value : '')
      else if (kind === 'price') setPrice(typeof value === 'number' ? (value / 100).toFixed(2) : '')
    }
    setValues(next); markDirty()
  }

  const uploadPending = async () => {
    if (!transport || !pendingMedia.length) return { choices: media, cover: coverId }
    const uploaded: RestoredMedia[] = []
    for (const pending of pendingMedia) uploaded.push(await uploadRestoredMedia(transport, pending.file, 'GOODS', pending.key))
    const next = [...media, ...uploaded.map((item, index) => ({ mediaId: item.mediaId, contentUrl: item.contentUrl, name: pendingMedia[index]!.file.name }))]
    const needsCover = Boolean(form && hasCore(form, 'cover'))
    const needsImages = Boolean(form && hasCore(form, 'images'))
    const nextCover = coverId ?? (needsCover || !needsImages ? next[0]?.mediaId ?? null : null)
    setMedia(next); setCoverId(nextCover); setPendingMedia([])
    return { choices: next, cover: nextCover }
  }

  const makeInput = async (complete: boolean): Promise<RestoredCreateGoodsDraftInput> => {
    if (!form) throw new Error('发布配置尚未加载')
    if (title.trim().length < 2 || title.trim().length > 100) throw new Error('商品标题需为 2–100 个字符')
    if (description.trim().length > 10_000) throw new Error('商品描述不能超过 10000 个字符')
    const priceFen = parseRestoredPriceFen(price)
    if (!priceFen) throw new Error('请输入正确的商品价格，最多两位小数')
    const highlight = tags(highlightTags), service = tags(serviceTags)
    if (highlight.length > 20 || service.length > 20 || [...highlight, ...service].some(tag => tag.length > 30)) throw new Error('标签每组最多 20 个，每个最多 30 个字符')
    const uploaded = await uploadPending()
    const core = { title: title.trim(), description: description.trim(), priceFen, coverMediaId: uploaded.cover, imageMediaIds: uploaded.choices.filter(item => item.mediaId !== uploaded.cover).map(item => item.mediaId) }
    const completeValues = { ...dynamicValues }
    for (const field of Object.values(form.fields)) {
      const kind = coreFieldKind(field)
      if (kind === 'cover') completeValues[field.fieldId] = core.coverMediaId ?? undefined
      else if (kind === 'images') completeValues[field.fieldId] = core.imageMediaIds
    }
    const issues = validateRestoredPublishSubmission(form, { core, fields: completeValues }, complete)
    if (issues.length) throw new Error(issues[0])
    return {
      gameCode, ...core, highlightTags: highlight, servicePromiseTags: service,
      publishRevisionId: form.publishRevisionId, configVersionId: form.configVersionId,
      fields: collectRestoredGoodsFields(form, completeValues), reason: working ? '卖家更新本地商品草稿' : '卖家创建本地商品草稿',
    }
  }

  const persist = async (complete: boolean) => {
    if (!api || !persistence.current) throw new Error('本地商品接口尚未就绪')
    const input = await makeInput(complete)
    const fingerprint = restoredGoodsContentFingerprint(input)
    const kind = working ? 'edit' : 'create'
    const key = draftAttempts.current.acquire(kind, fingerprint)
    try {
      const saved = await persistence.current.save(input, key)
      draftAttempts.current.settle(kind, fingerprint, 'SUCCESS')
      setWorking(saved); setDirty(false); setSavedThisSession(true)
      return saved
    } catch (caught) {
      draftAttempts.current.settle(kind, fingerprint, caught instanceof RestoredHttpError && caught.outcome === 'UNKNOWN' ? 'UNKNOWN' : 'FAILED')
      throw caught
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy('save'); setError(''); setNotice('')
    try { const saved = await persist(false); setNotice(`草稿已保存（${saved.goodsNo}），未自动送审。`) }
    catch (caught) { setError(unknownMessage(caught)) } finally { setBusy('') }
  }

  const submit = async () => {
    if (busy || !api) return
    if (working && !dirty && !savedThisSession && working.currentAudit?.submittedContentRevision === working.contentRevision) return setError('请先实质修改商品内容，再重新送审')
    setBusy('submit'); setError(''); setNotice('')
    try {
      const saved = await persist(true)
      const key = submitAttempts.current.acquire(saved.id, saved.contentRevision)
      await api.submit(saved.id, { rowVersion: saved.rowVersion, contentRevision: saved.contentRevision, reason: '卖家提交商品内容审核' }, key)
      submitAttempts.current.succeeded(saved.id, saved.contentRevision); navigate('/my-goods', { replace: true })
    } catch (caught) {
      setError(`${unknownMessage(caught)}${persistence.current?.getCurrent() ? '草稿和商品 ID 已保留，再次提交不会新建商品。' : ''}`)
      setWorking(persistence.current?.getCurrent() ?? null)
    } finally { setBusy('') }
  }

  if (status !== 'ready' || !transport) return <main className="restored-goods-page"><GoodsHeader title="发布商品" /><section className="restored-goods-connection"><Store size={25} /><Heading as="h2" variant="result">{status === 'error' ? '本地联动未连接' : '正在连接本地联动'}</Heading>{connectionError && <p role="alert">{connectionError}</p>}{status === 'error' && <Button onClick={reconnect}>重新连接</Button>}</section></main>
  const needsMaterialEdit = Boolean(working?.currentAudit?.submittedContentRevision === working?.contentRevision && !dirty && !savedThisSession)
  return <main className="restored-goods-page"><GoodsHeader title={working ? '编辑并重新送审' : '发布商品'} /><div className="restored-goods-scroll">
    <aside className="restored-goods-notice">本页使用后台已发布的完整 PUBLISH 步骤与冻结选项；配置标识不一致时会阻止保存，不会用扁平目录猜测布局。</aside>
    {sellerState.error && <p className="restored-goods-stale" role="alert">{sellerState.error}</p>}
    {!sellerState.loading && !sellerState.seller?.canPublish && <section className="restored-goods-blocked"><Store size={25} /><Heading as="h2" variant="result">暂不可发布</Heading><p>卖家申请、签署或当前限制状态不允许发布商品。</p><Link to="/seller/center">查看卖家状态</Link></section>}
    {working?.currentAudit?.reviewReason && <p className="restored-goods-audit-note">上次审核说明：{working.currentAudit.reviewReason}</p>}
    {error && <p className="restored-goods-error" role="alert">{error}</p>}
    {notice && <p className="restored-goods-success" role="status">{notice}</p>}
    {loading && <p className="restored-goods-loading" role="status">正在核对完整发布配置…</p>}
    {form && <form id="restored-goods-form" onSubmit={save} noValidate>
      <SelectField label="游戏" value={gameCode} disabled={blocked || Boolean(working)} hint={working ? '编辑时不能变更原商品游戏' : '切换游戏会重新读取该游戏已发布的 PUBLISH 步骤'} onChange={event => { void changeGame(event.target.value) }} options={games.map(game => ({ value: game.code, label: game.name }))} />
      {!hasCore(form, 'title') && <TextField label="商品标题" value={title} disabled={blocked} minLength={2} maxLength={100} required placeholder="请输入 2–100 个字符" onChange={event => { setTitle(event.target.value); markDirty() }} />}
      {!hasCore(form, 'price') && <TextField label="价格（元）" value={price} disabled={blocked} inputMode="decimal" required placeholder="例如 1280.00" onChange={event => { setPrice(event.target.value.replace(/[^\d.]/gu, '')); markDirty() }} />}
      {!hasCore(form, 'description') && <TextAreaField label="商品描述" value={description} disabled={blocked} maxLength={10000} showCount placeholder="说明账号资产、换绑和实名情况" onChange={event => { setDescription(event.target.value); markDirty() }} />}
      <RestoredPublishDynamicFields form={form} values={dynamicValues} disabled={blocked} activeStep={activeStep} onActiveStepChange={setActiveStep} onChange={changeDynamic} renderGoodsMediaField={renderMediaField} />
      {!hasCore(form, 'cover') && !hasCore(form, 'images') && <fieldset className="restored-publish-media-field" disabled={blocked}><legend>商品图片</legend>{renderMediaField({ sourceKey: 'images' } as RestoredPublishDirectoryField)}</fieldset>}
      <TextField label="商品亮点标签（选填）" value={highlightTags} disabled={blocked} maxLength={619} placeholder="用逗号分隔，最多 20 个" onChange={event => { setHighlightTags(event.target.value); markDirty() }} />
      <TextField label="服务承诺标签（选填）" value={serviceTags} disabled={blocked} maxLength={619} placeholder="用逗号分隔，最多 20 个" onChange={event => { setServiceTags(event.target.value); markDirty() }} />
    </form>}
  </div>{form && <ActionBar className="restored-goods-footer" layout="equal"><Button form="restored-goods-form" type="submit" variant="secondary" disabled={blocked || Boolean(working && !dirty)} loading={busy === 'save'}>保存草稿</Button><Button type="button" disabled={blocked || needsMaterialEdit} loading={busy === 'submit'} onClick={() => { void submit() }}>提交审核</Button></ActionBar>}</main>
}
