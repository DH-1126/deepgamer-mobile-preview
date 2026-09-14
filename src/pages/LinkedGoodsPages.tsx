import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowLeft, ImagePlus, PackageOpen, RotateCcw, Store } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { linkedCommand, registerLinkedMedia, useLinkedState, type LinkedGoods, type LinkedState } from '../linked/linkedData'
import { canPublish } from '../../../双端演示/src/contract'
import { getLinkedPublishForm, validatePublishValues, type LinkedPublishForm } from '../../../双端演示/src/publish-config'
import { createLinkedGoodsDraftBaseline, getLinkedGoodsDraftConflict, type LinkedGoodsDraftBaseline } from '../linked/linkedGoodsDraftModel'
import { canChangeLinkedGoodsGame, getLinkedPublishFormConflict, hasLinkedPublishDraftInput, hydrateLinkedPublishValues, hydrateLinkedPublishValuesWithIssues, rebaseLinkedPublishDraftSources, type LinkedPublishFormValues } from '../linked/linkedPublishDraftModel'
import { LinkedPublishDynamicFields } from '../linked/LinkedPublishDynamicFields'
import { ActionBar, Button, Heading, IconButton, PageHeader, SelectField, TextAreaField, TextField } from '../components/ui'
import '../styles/linked-goods.css'

const auditLabels: Record<LinkedGoods['auditStatus'], string> = {
  NOT_SUBMITTED: '未提交', PENDING: '审核中', APPROVED: '审核通过', REJECTED: '审核拒绝', NEEDS_MORE_INFO: '待补充资料',
}
const productLabels: Record<LinkedGoods['productStatus'], string> = { ON_SALE: '在售', OFF_SHELF: '已下架', SOLD: '已售出' }

function LinkedHeader({ title }: { title: string }) {
  const navigate = useNavigate()
  return <PageHeader className="linked-goods-header" title={title} left={<IconButton label="返回" onClick={() => navigate(-1)}><ArrowLeft size={21} /></IconButton>} />
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '联动操作失败，请重试'
}

function parsePriceFen(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null
  const [yuan, decimal = ''] = value.split('.')
  const result = Number(yuan) * 100 + Number(decimal.padEnd(2, '0'))
  return Number.isSafeInteger(result) && result > 0 ? result : null
}

export function LinkedGoodsPublishPage() {
  const state = useLinkedState()
  const [params] = useSearchParams()
  const requestedGoodsId = params.get('goodsId')
  const baselineRef = useRef<LinkedGoodsDraftBaseline | null>(null)
  if (!baselineRef.current && state) baselineRef.current = createLinkedGoodsDraftBaseline(state, requestedGoodsId)
  const baseline = baselineRef.current
  if (!state || !baseline) return <main className="linked-goods-page"><LinkedHeader title="发布商品" /><div className="linked-goods-scroll"><p className="linked-goods-notice" role="status">正在连接联动演示并加载发布表单…</p></div></main>
  return <LinkedGoodsPublishForm state={state} baseline={baseline} requestedGoodsId={requestedGoodsId} />
}

function LinkedGoodsPublishForm({ state, baseline, requestedGoodsId }: { state: LinkedState; baseline: LinkedGoodsDraftBaseline; requestedGoodsId: string | null }) {
  const navigate = useNavigate()
  const existing = baseline?.kind === 'edit' ? baseline.goods : undefined
  const targetChanged = baseline && (baseline.kind === 'create' ? Boolean(requestedGoodsId) : requestedGoodsId !== baseline.goodsId)
  const goodsConflict = targetChanged ? '编辑目标已变化，当前草稿不会切换商品；请返回后重新进入表单' : getLinkedGoodsDraftConflict(state, baseline)
  const activeGames = useMemo(() => state.games.filter((game) => game.status === 'ACTIVE').sort((a, b) => a.sortOrder - b.sortOrder), [state])
  const [gameCode, setGameCode] = useState(existing?.gameCode ?? activeGames[0]?.code ?? 'wzry')
  const [publishForm, setPublishForm] = useState<LinkedPublishForm>(() => getLinkedPublishForm(state, existing?.gameCode ?? activeGames[0]?.code ?? 'wzry'))
  const [formValues, setFormValues] = useState<LinkedPublishFormValues>(() => hydrateLinkedPublishValues(publishForm, existing?.attributes ?? {}, existing?.groupSelections ?? {}))
  const [wizardStep, setWizardStep] = useState(0)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [price, setPrice] = useState(existing ? (existing.priceFen / 100).toFixed(2) : '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [platform, setPlatform] = useState(typeof existing?.attributes.platform === 'string' ? existing.attributes.platform : '')
  const [rank, setRank] = useState(typeof existing?.attributes.rank === 'string' ? existing.attributes.rank : '')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [formNotice, setFormNotice] = useState('')
  const [pendingGameCode, setPendingGameCode] = useState<typeof gameCode | null>(null)
  const eligible = Boolean(state && canPublish(state))
  const currentPublishForm = getLinkedPublishForm(state, gameCode)
  const publishConflict = getLinkedPublishFormConflict(currentPublishForm, publishForm)

  const switchGame = (nextGameCode: typeof gameCode) => {
    const nextForm = getLinkedPublishForm(state, nextGameCode)
    setGameCode(nextGameCode)
    setPublishForm(nextForm)
    setFormValues({})
    setWizardStep(0)
    setPlatform('')
    setRank('')
    setPendingGameCode(null)
    setError('')
    setFormNotice('已切换游戏并清空上一游戏的属性；标题、金额、描述和图片保持不变')
  }

  const requestGameSwitch = (nextGameCode: typeof gameCode) => {
    if (nextGameCode === gameCode || !canChangeLinkedGoodsGame(baseline.kind)) return
    if (hasLinkedPublishDraftInput(formValues, platform, rank)) {
      setPendingGameCode(nextGameCode)
      setError('')
      return
    }
    switchGame(nextGameCode)
  }

  const confirmGameSwitch = () => {
    if (!pendingGameCode) return
    if (!activeGames.some((game) => game.code === pendingGameCode)) {
      setPendingGameCode(null)
      setError('目标游戏已停用，请重新选择')
      return
    }
    switchGame(pendingGameCode)
  }

  const applyLatestPublishForm = () => {
    const latest = getLinkedPublishForm(state, gameCode)
    const draftSources = rebaseLinkedPublishDraftSources(publishForm, formValues, {
      attributes: existing?.attributes ?? {}, groupSelections: existing?.groupSelections ?? {},
    })
    const hydrated = hydrateLinkedPublishValuesWithIssues(latest, draftSources.attributes, draftSources.groupSelections)
    setPublishForm(latest)
    setFormValues(hydrated.values)
    setWizardStep(0)
    setError(hydrated.issues.join('；'))
    setFormNotice('已显式应用最新发布模板；核心商品资料保持不变，请重新核对游戏属性')
  }

  const chooseImages = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = [...(event.target.files ?? [])]
    event.target.value = ''
    if (selected.some((file) => !['image/jpeg', 'image/png'].includes(file.type) || file.size <= 0 || file.size > 10 * 1024 * 1024)) {
      setError('请选择10MB以内的 JPG 或 PNG 图片')
      return
    }
    if (files.length + selected.length > 6) { setError('商品图片最多选择 6 张'); return }
    setFiles((current) => [...current, ...selected]); setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    if (goodsConflict || publishConflict) return setError(goodsConflict || publishConflict)
    if (!state || !eligible) return setError('需先完成卖家审核并模拟签署协议，才能发布商品')
    if (!activeGames.some((game) => game.code === gameCode)) return setError('所选游戏已停用，请重新选择')
    if (publishForm.mode === 'BLOCKED') return setError(publishForm.issues.join('；') || '当前发布模板不可用')
    if (publishForm.reconstruction && wizardStep < publishForm.sections.length - 1) return setError('请先完成四步游戏资料，再提交审核')
    if (title.trim().length < 4 || title.trim().length > 80) return setError('商品标题需为 4–80 个字符')
    const priceFen = parsePriceFen(price)
    if (!priceFen) return setError('请输入正确的商品价格，最多两位小数')
    if (description.trim().length < 10 || description.trim().length > 1000) return setError('商品描述需为 10–1000 个字符')
    if (baseline.kind === 'create' && files.length === 0) return setError('请至少选择 1 张商品图片')
    let attributes: Record<string, unknown> | undefined
    if (publishForm.mode === 'CONFIGURED') {
      try { validatePublishValues(publishForm, formValues) }
      catch (caught) { return setError(errorMessage(caught)) }
    } else {
      attributes = {}
      if (platform.trim()) attributes.platform = platform.trim()
      if (rank.trim()) attributes.rank = rank.trim()
    }
    setSubmitting(true); setError('')
    try {
      const uploaded = await Promise.all(files.map(registerLinkedMedia))
      const payload = {
        ...(baseline.kind === 'edit' ? { goodsId: baseline.goodsId } : {}), gameCode, title: title.trim(), priceFen, description: description.trim(),
        mediaIds: uploaded.length ? uploaded.map((media) => media.mediaId) : baseline.kind === 'edit' ? baseline.goods.mediaIds : [],
        ...(publishForm.mode === 'CONFIGURED'
          ? { publishVersionId: publishForm.versionId, publishSchemaHash: publishForm.schemaHash, formValues }
          : { publishVersionId: null, publishSchemaHash: null, formValues: {}, attributes }),
      }
      if (baseline.kind === 'edit') await linkedCommand('GOODS_RESUBMIT', payload, { expectedVersion: baseline.rowVersion, sessionId: baseline.sessionId })
      else await linkedCommand('GOODS_SUBMIT', payload, { sessionId: baseline.sessionId })
      navigate('/linked/my-goods', { replace: true })
    } catch (caught) { setError(errorMessage(caught)) } finally { setSubmitting(false) }
  }

  const blocked = !eligible || submitting || Boolean(goodsConflict) || Boolean(publishConflict) || publishForm.mode === 'BLOCKED'
  const submitBlocked = blocked || Boolean(publishForm.reconstruction && wizardStep < publishForm.sections.length - 1)
  return <main className="linked-goods-page"><LinkedHeader title={baseline?.kind === 'invalid' ? '无法编辑商品' : existing ? '补充商品资料' : '发布商品'} /><div className="linked-goods-scroll">
    <aside className="linked-goods-notice">{publishForm.mode === 'CONFIGURED' ? `${publishForm.reconstruction ? '本地重建 · 线上版本未核验。' : ''}当前草稿使用模板 ${publishForm.versionId}；图片只保留在本次演示临时内存中。` : publishForm.mode === 'BASIC' ? '联动演示基础表单：该游戏暂无已发布动态模板。图片只保留在本次演示临时内存中。' : '当前游戏的发布模板不可用，已阻止提交，不会自动降级或猜测字段。'}</aside>
    {!eligible && <section className="linked-goods-blocked" role="status"><Store size={25} /><Heading as="h2" variant="result">暂不可发布</Heading><p>需先通过卖家认证，并在卖家中心完成模拟协议签署。</p><Link to="/seller/center">查看卖家认证进度</Link></section>}
    {goodsConflict && <p className="linked-goods-error" role="alert">{goodsConflict}</p>}
    {publishConflict && <section className="linked-publish-conflict" role="alert"><p>{publishConflict}</p>{currentPublishForm.mode !== 'BLOCKED' && <button type="button" onClick={applyLatestPublishForm}>应用最新模板</button>}{currentPublishForm.mode === 'BLOCKED' && <small>{currentPublishForm.issues.join('；')}</small>}</section>}
    {publishForm.mode === 'BLOCKED' && !publishConflict && <section className="linked-publish-blocked" role="alert"><Heading as="h2" variant="section">发布模板暂不可用</Heading><ul>{publishForm.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></section>}
    {formNotice && <p className="linked-publish-notice" role="status">{formNotice}</p>}
    {pendingGameCode && <section className="linked-publish-conflict" role="alert"><p>切换到 {activeGames.find((game) => game.code === pendingGameCode)?.name ?? pendingGameCode} 会清空已填的游戏属性，是否继续？</p><div className="linked-game-switch-actions"><button type="button" onClick={confirmGameSwitch}>确认切换并清空</button><button type="button" onClick={() => setPendingGameCode(null)}>取消</button></div></section>}
    <form id="linked-goods-form" onSubmit={submit} noValidate>
      <SelectField label="游戏" value={gameCode} disabled={!eligible || submitting || Boolean(goodsConflict) || !canChangeLinkedGoodsGame(baseline.kind)} hint={baseline.kind === 'edit' ? '编辑重提不可变更原商品所属游戏' : '切换游戏会在确认后清空已填游戏属性，保留核心资料与图片'} onChange={(event) => requestGameSwitch(event.target.value as typeof gameCode)} options={activeGames.map((game) => ({ value: game.code, label: game.name }))} />
      <TextField label="商品标题" value={title} disabled={blocked} maxLength={80} placeholder="概括账号亮点，4–80字" onChange={(event) => setTitle(event.target.value)} />
      <TextField label="价格（元）" value={price} disabled={blocked} inputMode="decimal" placeholder="例如 1280.00" onChange={(event) => setPrice(event.target.value.replace(/[^\d.]/g, ''))} />
      {publishForm.mode === 'BASIC' && <div className="linked-goods-two"><TextField label="区服（选填）" value={platform} disabled={blocked} maxLength={30} placeholder="例如 安卓QQ" onChange={(event) => setPlatform(event.target.value)} /><TextField label="段位（选填）" value={rank} disabled={blocked} maxLength={30} placeholder="例如 最强王者" onChange={(event) => setRank(event.target.value)} /></div>}
      <TextAreaField label="商品描述" value={description} disabled={blocked} maxLength={1000} showCount placeholder="说明账号资产、换绑与实名情况，至少10字" onChange={(event) => setDescription(event.target.value)} />
      {publishForm.mode === 'CONFIGURED' && <LinkedPublishDynamicFields form={publishForm} values={formValues} disabled={blocked} activeStep={wizardStep} onActiveStepChange={(step) => { setWizardStep(step); setError('') }} onChange={(values) => { setFormValues(values); setError('') }} />}
      <fieldset disabled={blocked}><legend>商品图片{existing ? '（不选则保留原图）' : ''}</legend><label className="linked-goods-images"><input type="file" accept="image/jpeg,image/png" multiple onChange={chooseImages} /><ImagePlus size={22} /><b>选择 JPG / PNG</b><small>单张不超过10MB，最多6张</small></label>{files.length > 0 && <ul>{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`}><span>{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>移除</button></li>)}</ul>}</fieldset>
      {error && <p className="linked-goods-error" role="alert">{error}</p>}
    </form>
  </div><ActionBar className="linked-goods-footer" layout="single"><Button form="linked-goods-form" type="submit" size="md" disabled={submitBlocked} loading={submitting}>{existing ? '重新提交审核' : '提交审核'}</Button></ActionBar></main>
}

export function LinkedGoodsListPage() {
  const state = useLinkedState()
  const [busyId, setBusyId] = useState('')
  const [confirmId, setConfirmId] = useState('')
  const [error, setError] = useState('')
  const goods = state?.goods.filter((item) => item.sellerId === state.seller.id).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)) ?? []
  const offShelf = async (item: LinkedGoods) => {
    if (!state) return
    setBusyId(item.id); setError('')
    try { await linkedCommand('GOODS_OFF_SHELF', { goodsId: item.id, reason: '卖家在用户端主动下架' }, { expectedVersion: item.rowVersion, sessionId: state.sessionId }); setConfirmId('') }
    catch (caught) { setError(errorMessage(caught)) } finally { setBusyId('') }
  }
  return <main className="linked-goods-page"><LinkedHeader title="我的商品" /><div className="linked-goods-scroll linked-goods-list">
    <aside className="linked-goods-notice">后台审核、拒绝或上下架后，本页会自动同步最新状态。</aside>
    <Link className="linked-goods-new" to="/linked/publish">发布新商品</Link>
    {error && <p className="linked-goods-error" role="alert">{error}</p>}
    {goods.length ? goods.map((item) => <article key={item.id}><div className="linked-goods-card-image">{item.images[0] ? <img src={item.images[0]} alt="" /> : <PackageOpen size={26} />}</div><div className="linked-goods-card-copy"><header><span>{auditLabels[item.auditStatus]}</span><em>{productLabels[item.productStatus]}</em></header><Heading as="h2" variant="subsection">{item.title}</Heading><p><span className="linked-goods-price">¥{(item.priceFen / 100).toFixed(2)}</span> · {item.goodsNo}</p>{item.reviewReason && <small>状态说明：{item.reviewReason}</small>}<footer>{item.auditStatus === 'APPROVED' && item.productStatus === 'ON_SALE' && <Link to={`/goods/${item.id}`}>查看详情</Link>}{item.productStatus === 'OFF_SHELF' && item.auditStatus !== 'PENDING' && <Link to={`/linked/publish?goodsId=${encodeURIComponent(item.id)}`}><RotateCcw size={14} />补充并重提</Link>}{item.productStatus === 'ON_SALE' && <button type="button" disabled={busyId === item.id} onClick={() => confirmId === item.id ? void offShelf(item) : setConfirmId(item.id)}>{busyId === item.id ? '下架中…' : confirmId === item.id ? '确认下架' : '下架'}</button>}</footer></div></article>) : <section className="linked-goods-empty"><PackageOpen size={30} /><Heading as="h2" variant="result">还没有发布商品</Heading><p>完成卖家审核与签署后，可提交第一件商品。</p></section>}
  </div></main>
}
