import { useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  ImagePlus,
  LoaderCircle,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  XCircle,
} from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  advanceSellerApplicationStep,
  applySellerPrototypeScenario,
  createSubmittedSellerApplication,
  isBusinessLicense,
  isChineseName,
  isCitizenId,
  isMainlandPhone,
  isRecognizedAddress,
  parseSellerPrototypeScenario,
  withApplicationStatus,
  type SellerApplicationSnapshot,
  type SellerEntityType,
  type SellerSubject,
} from '../components/sellerContractModel'
import { uploadSellerContractMedia, validateTakeoutOrderImage } from '../components/sellerContractMediaUpload'
import { sellerApplicationRepository } from '../repository/sellerApplicationRepository'
import { getLinkedState, linkedCommand, registerLinkedMedia, useLinkedState } from '../linked/linkedData'
import { isLinkedDataMode } from '../runtime/dataMode'
import type { LinkedSellerApplication } from '../../../双端演示/src/contract'
import { ActionBar, Dialog, Heading, IconButton, PageHeader, SurfaceCard, TextField as BaseTextField } from '../components/ui'
import '../styles/seller-contract-v2.css'

type TakeoutOrderMedia = { mediaId: string; fileName: string; previewUrl: string; file?: File }

function linkedSellerSnapshot(): SellerApplicationSnapshot {
  const seller = getLinkedState()?.seller
  if (!seller || seller.status === 'NONE') return { status: 'not_started', subject: null }
  const subject = seller.application?.subject ?? 'personal'
  const base: SellerApplicationSnapshot = { subject, status: 'under_review', entityType: seller.application?.entityType, takeoutOrderMediaId: seller.application?.takeoutOrderMediaId, submittedAt: seller.submittedAt ? Date.parse(seller.submittedAt) : undefined }
  if (seller.status === 'PENDING') return base
  if (seller.status === 'REJECTED') return { ...base, status: 'changes_requested' }
  return { ...base, status: seller.contractStatus === 'SIGNED' ? 'active' : 'approved' }
}

function SellerTopBar({ title, onBack }: { title: string; onBack?: () => void }) {
  const navigate = useNavigate()
  return <PageHeader className="seller-contract-v2-topbar" title={title} left={<IconButton label="返回" onClick={onBack ?? (() => navigate(-1))}><ChevronLeft size={24} aria-hidden="true" /></IconButton>} />
}

function FlowProgress({ step }: { step: number }) {
  const widths = [20, 40, 60, 75, 85]
  return <div className="seller-contract-v2-progress" aria-label={`第 ${step} / 5 步`}><i><span style={{ width: `${widths[step - 1] ?? 20}%` }} /></i><small>第 {step} / 5 步</small></div>
}

function FixedFooter({ children, hint }: { children: ReactNode; hint?: string }) {
  return <ActionBar sticky layout="single" description={hint} className="seller-contract-v2-fixed-footer">{children}</ActionBar>
}

function GuidePage({ onStart }: { onStart: () => void }) {
  const navigate = useNavigate()
  const [rightsOpen, setRightsOpen] = useState(false)
  return <main className="seller-contract-v2-page">
    <SellerTopBar title="成为卖家" onBack={() => navigate('/profile', { replace: true })} />
    <div className="seller-contract-v2-scroll seller-contract-v2-guide">
      <section className="seller-contract-v2-guide-hero"><Heading as="h2" variant="hero">开通卖家身份<br />发布账号并收款</Heading><p>完成开通后即可管理商品、履约订单、结算收入</p></section>
      <section className="seller-contract-v2-guide-card"><Heading as="h2" variant="section">开通后你可以</Heading><ul>{['发布和管理游戏账号', '接收买家订单', '参与交易履约与售后协作', '订单完成后结算收款'].map((item) => <li key={item}><i><Check size={12} strokeWidth={3} aria-hidden="true" /></i>{item}</li>)}</ul></section>
      <section className="seller-contract-v2-guide-card"><Heading as="h2" variant="section">开通流程 5 步</Heading><ol>{[
        ['选择主体', '个人 / 个体户 / 企业'], ['提交认证资料', '证件与联系人信息'], ['确认并提交', '提交前统一复核'], ['平台审核', '核验主体与证件'], ['签署协议', '签署后身份生效'],
      ].map(([title, detail], index) => <li key={title}><i>{index + 1}</i><span><b>{title}</b><small>{detail}</small></span></li>)}</ol></section>
    </div>
    <FixedFooter><button className="yellow" type="button" onClick={onStart}>开始开通</button><button className="text" type="button" onClick={() => setRightsOpen(true)}>查看卖家权益与规则</button></FixedFooter>
    {rightsOpen && <InfoDialog title="卖家权益与规则" onClose={() => setRightsOpen(false)}><p>个人、个体户和企业均可申请基础卖家。实际权益、费率与责任以审核结果及正式协议为准。</p><p>VIP 等级、升级条件与费率方案仍待产品确认，本原型不作承诺。</p></InfoDialog>}
  </main>
}

function SubjectSelectionPage({ onBack }: { onBack: () => void }) {
  const [subject, setSubject] = useState<SellerSubject>('personal')
  const navigate = useNavigate()
  return <main className="seller-contract-v2-page">
    <SellerTopBar title="选择卖家主体" onBack={onBack} />
    <div className="seller-contract-v2-scroll seller-contract-v2-subject-page">
      <FlowProgress step={1} />
      <p className="seller-contract-v2-lead">主体决定需要提交的资料与签署范围，正式提交后不能在页面自行更改。</p>
      <SubjectCard active={subject === 'personal'} icon={<UserRound />} title="个人" description="适合个人玩家出售自己的账号" tags={['身份证', '本人信息', '联系方式']} onClick={() => setSubject('personal')} />
      <SubjectCard active={subject === 'business'} icon={<Building2 />} title="个体户与企业" description="适合以个体工商户或企业身份经营的卖家" tags={['营业执照', '经营者/法人信息', '联系方式']} onClick={() => setSubject('business')} />
      <p className="seller-contract-v2-pending-note">卖家等级与主体类型分开管理；VIP 升级规则待产品确认。</p>
    </div>
    <FixedFooter><button className="dark" type="button" onClick={() => navigate(subject === 'personal' ? '/seller/apply/personal' : '/seller/apply/business')}>下一步</button></FixedFooter>
  </main>
}

function SubjectCard({ active, icon, title, description, tags, onClick }: { active: boolean; icon: ReactNode; title: string; description: string; tags: string[]; onClick: () => void }) {
  return <button type="button" className={`seller-contract-v2-subject-card${active ? ' active' : ''}`} onClick={onClick} aria-pressed={active}>
    <span>{icon}</span><div><Heading as="h2" variant="section">{title}</Heading><p>{description}</p></div><i aria-hidden="true"><b /></i>
    <footer><strong>需要准备</strong><div>{tags.map((tag) => <em key={tag}>{tag}</em>)}</div></footer>
  </button>
}

export function SellerCenterPage() {
  const navigate = useNavigate()
  useLinkedState()
  const [searchParams] = useSearchParams()
  const [snapshot, setSnapshot] = useState(() => isLinkedDataMode ? linkedSellerSnapshot() : sellerApplicationRepository.getSnapshot())
  const [scenario, setScenario] = useState(() => parseSellerPrototypeScenario(searchParams.get('scenario')))
  const [selecting, setSelecting] = useState(false)
  const [signing, setSigning] = useState(false)
  const displayed = isLinkedDataMode ? linkedSellerSnapshot() : applySellerPrototypeScenario(snapshot, scenario)

  const commitStatus = (status: SellerApplicationSnapshot['status']) => {
    if (isLinkedDataMode) {
      if (status === 'under_review') navigate(displayed.subject === 'business' ? '/seller/apply/business' : '/seller/apply/personal')
      return
    }
    const next = withApplicationStatus(displayed, status)
    sellerApplicationRepository.save(next)
    setSnapshot(next)
    setScenario(null)
  }

  if (signing) return <AgreementSigningPage snapshot={displayed} onBack={() => setSigning(false)} onComplete={async () => {
    if (isLinkedDataMode) {
      const current = getLinkedState()
      if (!current) throw new Error('联动演示未连接')
      await linkedCommand('SELLER_SIGN_SIMULATED', {}, { expectedVersion: current.seller.rowVersion, sessionId: current.sessionId })
      setSigning(false)
    } else { setSigning(false); commitStatus('active') }
  }} />
  if (displayed.status === 'not_started') return selecting ? <SubjectSelectionPage onBack={() => setSelecting(false)} /> : <GuidePage onStart={() => setSelecting(true)} />
  if (displayed.status === 'under_review') return <ReviewingPage />
  if (displayed.status === 'changes_requested') return <ChangesRequestedPage snapshot={displayed} reason={isLinkedDataMode ? getLinkedState()?.seller.reviewReason : undefined} onResubmit={() => commitStatus('under_review')} />
  if (displayed.status === 'approved') return <ApprovedPage snapshot={displayed} onSign={() => setSigning(true)} />
  return <CompletedPage snapshot={displayed} />
}

function StatusShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return <main className="seller-contract-v2-page"><SellerTopBar title="卖家开通进度" onBack={() => navigate('/profile', { replace: true })} /><div className="seller-contract-v2-scroll seller-contract-v2-status-page">{children}</div></main>
}

function ReviewingPage() {
  const navigate = useNavigate()
  return <StatusShell>
    <StatusHero tone="pending" icon={<Clock3 />} title="平台审核中" detail="资料已提交，平台正在核验主体与证件信息" />
    <section className="seller-contract-v2-timeline"><StatusLine state="done" title="资料已提交" detail="申请已进入审核流程" /><StatusLine state="current" title="平台审核中" detail="正在核验主体与证件信息" /><StatusLine title="签署协议" detail="审核通过后进行" /><StatusLine title="卖家身份生效" detail="签署完成后可使用卖家能力" /></section>
    <section className="seller-contract-v2-status-card"><Heading as="h2" variant="section">审核期间</Heading><p>可随时离开本页，审核结果将通过站内消息通知。审核时效以平台实际处理为准。</p></section>
    <FixedFooter><button className="muted" type="button" onClick={() => navigate('/profile')}>返回我的</button></FixedFooter>
  </StatusShell>
}

function ChangesRequestedPage({ snapshot, reason, onResubmit }: { snapshot: SellerApplicationSnapshot; reason?: string; onResubmit: () => void }) {
  const [editing, setEditing] = useState(false)
  const [idImage, setIdImage] = useState('')
  const [citizenId, setCitizenId] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const submit = () => {
    if (!idImage) return setError('请重新选择清晰的身份证人像面')
    if (!isCitizenId(citizenId)) return setError('请输入正确的 18 位身份证号')
    if (!isMainlandPhone(phone)) return setError('请输入正确的联系人手机号')
    onResubmit()
  }
  return <StatusShell>
    <StatusHero tone="error" icon={<XCircle />} title="部分资料需要重新提交" detail="已通过的资料会保留，只需修改标记项目" />
    <section className="seller-contract-v2-issue-card">{reason ? <Issue title="平台审核意见" reason={reason} action="重新填写" onClick={onResubmit} /> : <><Issue title="身份证人像面" reason="照片清晰度不足，关键信息无法识别" action="重新上传" onClick={() => setEditing(true)} /><Issue title="身份证号" reason="与证件识别结果不一致" action="去修改" onClick={() => setEditing(true)} /><Issue title="联系人手机号" reason="号码未通过格式校验" action="去修改" onClick={() => setEditing(true)} /></>}</section>
    <section className="seller-contract-v2-status-card"><Heading as="h2" variant="section">保留的资料</Heading><div className="seller-contract-v2-kept"><span>✓ 主体类型</span><span>✓ 身份证国徽面</span><span>✓ 姓名</span><span>✓ 联系人姓名</span>{snapshot.takeoutOrderMediaId && <span>✓ 外卖订单媒体凭证</span>}</div></section>
    {editing && <section className="seller-contract-v2-form-card correction"><Heading as="h2" variant="section">修改标记项目</Heading><ImageField label="身份证人像面" value={idImage} onChange={setIdImage} /><TextField label="身份证号" value={citizenId} onChange={setCitizenId} placeholder="请输入 18 位身份证号" maxLength={18} /><TextField label="联系人手机号" value={phone} onChange={setPhone} placeholder="请输入 11 位手机号" inputMode="tel" maxLength={11} />{error && <FormError message={error} />}</section>}
    <FixedFooter hint={reason ? '联动演示需重新填写并提交本次申请' : '只需修改标记项，其余资料无需重填'}><button className="dark" type="button" onClick={reason ? onResubmit : editing ? submit : () => setEditing(true)}>{reason ? '重新填写资料' : editing ? '重新提交审核' : '修改资料并重新提交'}</button></FixedFooter>
  </StatusShell>
}

function Issue({ title, reason, action, onClick }: { title: string; reason: string; action: string; onClick: () => void }) {
  return <div className="seller-contract-v2-issue"><i /><div><b>{title}</b><small>{reason}</small></div><button type="button" onClick={onClick}>{action}</button></div>
}

function ApprovedPage({ snapshot, onSign }: { snapshot: SellerApplicationSnapshot; onSign: () => void }) {
  return <StatusShell>
    <StatusHero tone="success" icon={<Check />} title="审核已通过" detail="还差最后一步：签署卖家协议后身份即生效" />
    <section className="seller-contract-v2-status-card"><Heading as="h2" variant="section">已核验</Heading><dl><div><dt>主体类型</dt><dd>{subjectLabel(snapshot)}</dd></div><div><dt>主体资料</dt><dd>已通过核验</dd></div><div><dt>联系人</dt><dd>已通过核验</dd></div></dl></section>
    <section className="seller-contract-v2-next-card"><Heading as="h2" variant="section">下一步：签署卖家协议</Heading><p>签署完成后身份生效。具体发布、接单与结算能力以平台规则为准。</p></section>
    <FixedFooter><button className="yellow" type="button" onClick={onSign}>去签署协议</button></FixedFooter>
  </StatusShell>
}

function AgreementSigningPage({ snapshot, onBack, onComplete }: { snapshot: SellerApplicationSnapshot; onBack: () => void; onComplete: () => void | Promise<void> }) {
  const [accepted, setAccepted] = useState(false)
  const [dialog, setDialog] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const complete = async () => { if (!accepted) return setError('请先阅读协议说明并确认同意'); setSubmitting(true); setError(''); try { await onComplete() } catch (caught) { setError(caught instanceof Error ? caught.message : '模拟签署失败，请重试') } finally { setSubmitting(false) } }
  return <main className="seller-contract-v2-page"><SellerTopBar title="签署卖家协议" onBack={onBack} /><div className="seller-contract-v2-scroll seller-contract-v2-signing"><FlowProgress step={5} />
    <section className="seller-contract-v2-sign-summary"><div><small>签约主体</small><b>{subjectLabel(snapshot)}</b></div><div><small>签约身份</small><b>基础卖家</b></div></section>
    <section className="seller-contract-v2-agreements"><Heading as="h2" variant="section">待签署协议</Heading>{['卖家服务协议', '平台交易规则', '相关授权协议'].map((name) => <button type="button" key={name} onClick={() => setDialog(name)}><FileText size={18} aria-hidden="true" /><b>《{name}》</b><em>内容待确认</em><ChevronRight size={18} aria-hidden="true" /></button>)}</section>
    <section className="seller-contract-v2-prototype-note"><ShieldCheck size={18} aria-hidden="true" /><p>协议名称、正式条款与签署验证方式待产品确认；本页仅演示阅读确认流程，不发送短信，也不代表已完成真实签约。</p></section>
    <button type="button" className="seller-contract-v2-check" role="checkbox" aria-checked={accepted} onClick={() => { setAccepted((value) => !value); setError('') }}><i>{accepted && <Check size={14} />}</i>我已阅读协议说明并同意继续原型流程</button>
    {error && <FormError message={error} />}
  </div><FixedFooter><button className="dark" type="button" disabled={submitting} onClick={() => void complete()}>{submitting ? '提交中…' : '确认并完成原型签署'}</button></FixedFooter>
  {dialog && <InfoDialog title={`《${dialog}》`} onClose={() => setDialog('')}><p>正式协议内容尚未确认，因此这里不展示或要求用户接受样例条款。</p><p>上线前应由产品、法务与后端共同确认协议版本、签署证据和验证方式。</p></InfoDialog>}</main>
}

function CompletedPage({ snapshot }: { snapshot: SellerApplicationSnapshot }) {
  const navigate = useNavigate()
  return <main className="seller-contract-v2-page"><SellerTopBar title="卖家中心" onBack={() => navigate('/profile', { replace: true })} /><div className="seller-contract-v2-scroll seller-contract-v2-complete"><StatusHero tone="success" icon={<Check />} title="卖家身份已开通" detail={`${subjectLabel(snapshot)} · 基础卖家`} /><section className="seller-contract-v2-status-card"><Heading as="h2" variant="section">你现在可以</Heading><ul>{['发布账号商品', '管理在售与已下架商品', '接收订单并履约', '参与售后协作', '查看卖家收入'].map((item) => <li key={item}><Check size={17} aria-hidden="true" />{item}</li>)}</ul></section></div><FixedFooter><Link className="dark" to={isLinkedDataMode ? '/linked/publish' : '/sell'}>去发布商品</Link>{isLinkedDataMode && <Link className="text" to="/linked/my-goods">我的商品</Link>}<Link className="text" to="/profile">进入我的</Link></FixedFooter></main>
}

function StatusHero({ tone, icon, title, detail }: { tone: 'pending' | 'error' | 'success'; icon: ReactNode; title: string; detail: string }) {
  return <section className={`seller-contract-v2-status-hero ${tone}`}><span>{icon}</span><Heading as="h2" variant="result">{title}</Heading><p>{detail}</p></section>
}

function StatusLine({ state, title, detail }: { state?: 'done' | 'current'; title: string; detail: string }) {
  return <div className={state ?? ''}><i>{state === 'done' && <Check size={12} />}</i><span><b>{title}</b><small>{detail}</small></span></div>
}

function InfoDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <Dialog open onClose={onClose} title={title}>{children}</Dialog>
}

function subjectLabel(snapshot: SellerApplicationSnapshot) {
  if (snapshot.subject === 'personal') return '个人'
  return snapshot.entityType === 'individual' ? '个体工商户' : snapshot.entityType === 'company' ? '企业' : '个体户或企业'
}

type ImageFieldProps = { label: string; value: string; onChange: (value: string) => void; onFile?: (file: File) => void; hint?: string }

function ImageField({ label, value, onChange, onFile, hint = 'JPG / PNG' }: ImageFieldProps) {
  const id = useId()
  const [error, setError] = useState('')
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const problem = validateTakeoutOrderImage(file)
    if (problem) { setError(problem); onChange(''); return }
    setError(''); onChange(file.name); onFile?.(file)
  }
  return <label className={`seller-contract-v2-image-field${value ? ' selected' : ''}`} htmlFor={id}><input id={id} type="file" accept="image/jpeg,image/png" onChange={change} /><span>{value ? <Check size={18} /> : <Upload size={18} />}</span><b>{value ? '已选择' : label}</b><small>{error || value || hint}</small></label>
}

function ImagePair({ first, second, firstLabel, secondLabel, setFirst, setSecond, onFirstFile, onSecondFile }: { first: string; second: string; firstLabel: string; secondLabel: string; setFirst: (value: string) => void; setSecond: (value: string) => void; onFirstFile?: (file: File) => void; onSecondFile?: (file: File) => void }) {
  return <div className="seller-contract-v2-image-pair"><ImageField label={firstLabel} value={first} onChange={setFirst} onFile={onFirstFile} /><ImageField label={secondLabel} value={second} onChange={setSecond} onFile={onSecondFile} /></div>
}

function TextField({ label, value, onChange, placeholder, hint, inputMode = 'text', maxLength = 60 }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; hint?: string; inputMode?: 'text' | 'numeric' | 'tel'; maxLength?: number }) {
  return <BaseTextField className="seller-contract-v2-field" label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} autoComplete="off" hint={hint} />
}

function FormError({ message }: { message: string }) {
  return <p className="seller-contract-v2-error" role="alert"><AlertCircle size={15} aria-hidden="true" />{message}</p>
}

function SubSteps({ labels, current }: { labels: string[]; current: number }) {
  return <div className="seller-contract-v2-substeps" aria-label="资料填写步骤">{labels.map((label, index) => <div key={label} className={index === current ? 'active' : index < current ? 'done' : ''}><i>{index < current ? <Check size={12} /> : index + 1}</i><span>{label}</span></div>)}</div>
}

function FormCard({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return <SurfaceCard className="seller-contract-v2-form-card"><Heading variant="section">{title}</Heading>{note && <p className="seller-contract-v2-form-note">{note}</p>}{children}</SurfaceCard>
}

function ReviewRow({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return <div className="seller-contract-v2-review-row"><span>{label}</span><b>{value || '—'}</b>{onEdit && <button type="button" onClick={onEdit}>编辑</button>}</div>
}

function TakeoutOrderUpload({ value, onChange, onError }: { value: TakeoutOrderMedia | null; onChange: (value: TakeoutOrderMedia | null) => void; onError: (message: string) => void }) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'loading' | 'uploaded' | 'error'>(value ? 'loading' : 'idle')
  const [uploadError, setUploadError] = useState('')
  const select = () => inputRef.current?.click()
  const handle = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const problem = validateTakeoutOrderImage(file)
    if (problem) { setStatus('error'); setUploadError(problem); onError(problem); return }
    setStatus('uploading'); setUploadError(''); onError('')
    try {
      const uploaded = await uploadSellerContractMedia(file)
      if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl)
      onChange({ ...uploaded, previewUrl: URL.createObjectURL(file), file })
      setStatus('loading')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '图片上传失败，请重试'
      setStatus('error'); setUploadError(message); onError(message)
    }
  }
  const remove = () => { if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl); onChange(null); setStatus('idle'); setUploadError(''); onError('') }
  return <section className="seller-contract-v2-takeout" aria-busy={status === 'uploading' || status === 'loading'}><Heading as="h3" variant="subsection">外卖订单截图<em>*</em></Heading><input ref={inputRef} id={inputId} type="file" accept="image/jpeg,image/png" onChange={handle} />
    {value ? <div className="seller-contract-v2-takeout-preview"><img src={value.previewUrl} alt="外卖订单截图预览" onLoad={() => setStatus('uploaded')} onError={() => { const message = '图片预览加载失败，请重新上传'; setStatus('error'); setUploadError(message); onError(message) }} /><div><b>{value.fileName}</b><small>已生成本地媒体凭证</small></div><button type="button" onClick={select}><RotateCcw size={15} />重传</button><button type="button" onClick={remove}><Trash2 size={15} />删除</button></div> : <button type="button" className="seller-contract-v2-takeout-picker" disabled={status === 'uploading'} onClick={select}><span>{status === 'uploading' ? <LoaderCircle className="spinning" /> : <ImagePlus />}</span><b>{status === 'uploading' ? '正在处理图片…' : '上传外卖订单截图'}</b><small>JPG / PNG，不超过 10MB</small></button>}
    {uploadError && <FormError message={uploadError} />}<p>请上传近 30 天相关订单截图；识别地址可在下方手动校正。</p>
  </section>
}

type PersonalForm = { idFront: string; idBack: string; realName: string; citizenId: string; contactName: string; contactPhone: string; emergencyName: string; emergencyPhone: string; identifiedAddress: string; takeoutOrder: TakeoutOrderMedia | null }

const emptyPersonal: PersonalForm = { idFront: '', idBack: '', realName: '', citizenId: '', contactName: '', contactPhone: '', emergencyName: '', emergencyPhone: '', identifiedAddress: '', takeoutOrder: null }

export function PersonalSellerContractPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyPersonal)
  const [idFiles, setIdFiles] = useState<{ front?: File; back?: File }>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof PersonalForm>(key: K, value: PersonalForm[K]) => { setForm((current) => ({ ...current, [key]: value })); setError('') }
  const back = () => step ? setStep((value) => value - 1) : navigate('/seller/center', { replace: true })
  const next = () => {
    if (step === 0 && (!form.idFront || !form.idBack)) return setError('请上传身份证国徽面和人像面')
    if (step === 0 && !isChineseName(form.realName)) return setError('请输入正确的姓名')
    if (step === 0 && !isCitizenId(form.citizenId)) return setError('请输入正确的 18 位身份证号')
    if (step === 1 && !isChineseName(form.contactName)) return setError('请输入正确的联系人姓名')
    if (step === 1 && !isMainlandPhone(form.contactPhone)) return setError('请输入正确的联系人手机号')
    if (step === 1 && !isChineseName(form.emergencyName)) return setError('请输入正确的紧急联系人姓名')
    if (step === 1 && !isMainlandPhone(form.emergencyPhone)) return setError('请输入正确的紧急联系人手机号')
    if (step === 1 && !form.takeoutOrder?.mediaId) return setError('请上传外卖订单截图')
    if (step === 1 && !isRecognizedAddress(form.identifiedAddress)) return setError('请补充或校正确认地址')
    setError(''); setStep((value) => Math.min(2, value + 1))
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    if (!form.takeoutOrder?.mediaId) return setError('外卖订单媒体凭证已失效，请重新上传')
    if (isLinkedDataMode) {
      const state = getLinkedState()
      if (!state) return setError('联动演示未连接')
      if (!idFiles.front || !idFiles.back || !form.takeoutOrder.file) return setError('图片临时凭证已失效，请重新选择后提交')
      setSubmitting(true); setError('')
      try {
        const [idFront, idBack, takeout] = await Promise.all([registerLinkedMedia(idFiles.front), registerLinkedMedia(idFiles.back), registerLinkedMedia(form.takeoutOrder.file)])
        const application: LinkedSellerApplication = { subject: 'personal', applicationName: form.realName.trim(), idNumber: form.citizenId.trim(), contactName: form.contactName.trim(), contactPhone: form.contactPhone.trim(), emergencyName: form.emergencyName.trim(), emergencyPhone: form.emergencyPhone.trim(), idFrontMediaId: idFront.mediaId, idBackMediaId: idBack.mediaId, takeoutOrderMediaId: takeout.mediaId, identifiedAddress: form.identifiedAddress.trim() }
        await linkedCommand('SELLER_SUBMIT', { application }, { expectedVersion: state.seller.rowVersion, sessionId: state.sessionId })
        navigate('/seller/center', { replace: true })
      } catch (caught) { setError(caught instanceof Error ? caught.message : '提交失败，请重试') } finally { setSubmitting(false) }
      return
    }
    if (!sellerApplicationRepository.save(createSubmittedSellerApplication('personal', form.takeoutOrder.mediaId))) return setError('提交状态保存失败，请重试')
    navigate('/seller/center', { replace: true })
  }
  return <ApplicationShell title="个人主体认证" flowStep={step === 2 ? 3 : 2} onBack={back} onSubmit={submit} error={error} footerLabel={step === 0 ? '下一步，填写联系人' : step === 1 ? '下一步，确认资料' : '确认提交审核'} onNext={step < 2 ? next : undefined} submitting={submitting}>
    <SubSteps labels={['身份信息', '联系人']} current={Math.min(step, 1)} />
    {step === 0 && <FormCard title="身份信息" note="平台会按本次提交的证件图片与填写信息进行核验。"><ImagePair first={form.idBack} second={form.idFront} firstLabel="国徽面" secondLabel="人像面" setFirst={(value) => set('idBack', value)} setSecond={(value) => set('idFront', value)} onFirstFile={(file) => setIdFiles((current) => ({ ...current, back: file }))} onSecondFile={(file) => setIdFiles((current) => ({ ...current, front: file }))} /><p className="seller-contract-v2-ocr-note">自动识别能力待接入，请按证件如实填写并自行确认。</p><TextField label="姓名" value={form.realName} onChange={(value) => set('realName', value)} placeholder="请输入姓名" maxLength={20} hint="需与证件保持一致" /><TextField label="身份证号" value={form.citizenId} onChange={(value) => set('citizenId', value)} placeholder="请输入身份证号" maxLength={18} hint="需与证件保持一致" /></FormCard>}
    {step === 1 && <><FormCard title="联系人" note="用于审核结果通知与协议签署联系。"><TextField label="联系人姓名" value={form.contactName} onChange={(value) => set('contactName', value)} placeholder="请输入联系人姓名" maxLength={20} /><TextField label="手机号" value={form.contactPhone} onChange={(value) => set('contactPhone', value)} placeholder="请输入手机号" inputMode="tel" maxLength={11} /><TextField label="紧急联系人姓名" value={form.emergencyName} onChange={(value) => set('emergencyName', value)} placeholder="请输入紧急联系人姓名" maxLength={20} /><TextField label="紧急联系人手机号" value={form.emergencyPhone} onChange={(value) => set('emergencyPhone', value)} placeholder="请输入紧急联系人手机号" inputMode="tel" maxLength={11} /></FormCard><FormCard title="订单与识别地址"><TakeoutOrderUpload value={form.takeoutOrder} onChange={(value) => set('takeoutOrder', value)} onError={setError} /><div className="seller-contract-v2-address"><MapPin size={18} /><TextField label="识别地址（可编辑）" value={form.identifiedAddress} onChange={(value) => set('identifiedAddress', value)} placeholder="请根据订单截图填写或校正地址" maxLength={120} hint="请核对并确保与订单一致" /></div></FormCard></>}
    {step === 2 && <ReviewCard subject="个人" form={form} setStep={setStep} />}
  </ApplicationShell>
}

type BusinessForm = { entityType: SellerEntityType; license: string; companyName: string; licenseNo: string; idFront: string; idBack: string; operatorName: string; citizenId: string; contactName: string; contactPhone: string; takeoutOrder: TakeoutOrderMedia | null }
const emptyBusiness: BusinessForm = { entityType: 'individual', license: '', companyName: '', licenseNo: '', idFront: '', idBack: '', operatorName: '', citizenId: '', contactName: '', contactPhone: '', takeoutOrder: null }

export function BusinessSellerContractPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyBusiness)
  const [mediaFiles, setMediaFiles] = useState<{ license?: File; front?: File; back?: File }>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof BusinessForm>(key: K, value: BusinessForm[K]) => { setForm((current) => ({ ...current, [key]: value })); setError('') }
  const operator = form.entityType === 'company' ? '法人' : '经营者'
  const next = () => {
    if (step === 0 && !form.license) return setError('请上传营业执照')
    if (step === 0 && form.companyName.trim().length < 2) return setError('请输入营业执照上的主体名称')
    if (step === 0 && !isBusinessLicense(form.licenseNo)) return setError('请输入正确的统一社会信用代码或注册号')
    if (step === 1 && (!form.idFront || !form.idBack)) return setError(`请上传${operator}身份证国徽面和人像面`)
    if (step === 1 && !isChineseName(form.operatorName)) return setError(`请输入正确的${operator}姓名`)
    if (step === 1 && !isCitizenId(form.citizenId)) return setError(`请输入正确的${operator}身份证号`)
    if (step === 2 && !isChineseName(form.contactName)) return setError('请输入正确的联系人姓名')
    if (step === 2 && !isMainlandPhone(form.contactPhone)) return setError('请输入正确的联系人手机号')
    if (step === 2 && !form.takeoutOrder?.mediaId) return setError('请上传外卖订单截图')
    setError(''); setStep((value) => Math.min(3, value + 1))
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    if (!form.takeoutOrder?.mediaId) return setError('外卖订单媒体凭证已失效，请重新上传')
    if (isLinkedDataMode) {
      const state = getLinkedState()
      if (!state) return setError('联动演示未连接')
      if (!mediaFiles.license || !mediaFiles.front || !mediaFiles.back || !form.takeoutOrder.file) return setError('图片临时凭证已失效，请重新选择后提交')
      setSubmitting(true); setError('')
      try {
        const [license, idFront, idBack, takeout] = await Promise.all([registerLinkedMedia(mediaFiles.license), registerLinkedMedia(mediaFiles.front), registerLinkedMedia(mediaFiles.back), registerLinkedMedia(form.takeoutOrder.file)])
        const application: LinkedSellerApplication = { subject: 'business', entityType: form.entityType, applicationName: form.companyName.trim(), licenseNo: form.licenseNo.trim(), operatorName: form.operatorName.trim(), operatorIdNumber: form.citizenId.trim(), contactName: form.contactName.trim(), contactPhone: form.contactPhone.trim(), businessLicenseMediaId: license.mediaId, operatorIdFrontMediaId: idFront.mediaId, operatorIdBackMediaId: idBack.mediaId, takeoutOrderMediaId: takeout.mediaId }
        await linkedCommand('SELLER_SUBMIT', { application }, { expectedVersion: state.seller.rowVersion, sessionId: state.sessionId })
        navigate('/seller/center', { replace: true })
      } catch (caught) { setError(caught instanceof Error ? caught.message : '提交失败，请重试') } finally { setSubmitting(false) }
      return
    }
    if (!sellerApplicationRepository.save(createSubmittedSellerApplication('business', form.takeoutOrder.mediaId, Date.now(), form.entityType))) return setError('提交状态保存失败，请重试')
    navigate('/seller/center', { replace: true })
  }
  return <ApplicationShell title={form.entityType === 'company' ? '企业主体认证' : '个体户与企业主体认证'} flowStep={step === 3 ? 3 : 2} onBack={() => step ? setStep((value) => value - 1) : navigate('/seller/center', { replace: true })} onSubmit={submit} error={error} footerLabel={step === 0 ? `下一步，填写${operator}信息` : step === 1 ? '下一步，填写联系人' : step === 2 ? '下一步，确认资料' : '确认提交审核'} onNext={step < 3 ? next : undefined} submitting={submitting}>
    <SubSteps labels={[form.entityType === 'company' ? '企业资料' : '主体资料', operator, '联系人']} current={Math.min(step, 2)} />
    {step === 0 && <FormCard title={form.entityType === 'company' ? '企业信息' : '个体户信息'} note="请上传营业执照原件照片或加盖公章的复印件。"><div className="seller-contract-v2-entity-switch"><button type="button" className={form.entityType === 'individual' ? 'active' : ''} onClick={() => set('entityType', 'individual')}>个体工商户</button><button type="button" className={form.entityType === 'company' ? 'active' : ''} onClick={() => set('entityType', 'company')}>企业</button></div><ImageField label="上传营业执照" value={form.license} onChange={(value) => set('license', value)} onFile={(file) => setMediaFiles((current) => ({ ...current, license: file }))} /><p className="seller-contract-v2-ocr-note">自动识别能力待接入，请按营业执照如实填写。</p><TextField label={`${form.entityType === 'company' ? '企业' : '个体户'}名称`} value={form.companyName} onChange={(value) => set('companyName', value)} placeholder={`请输入${form.entityType === 'company' ? '企业' : '个体户'}名称`} hint="需与营业执照一致" /><TextField label="统一社会信用代码 / 注册号" value={form.licenseNo} onChange={(value) => set('licenseNo', value.toUpperCase())} placeholder="请输入统一社会信用代码" maxLength={24} /></FormCard>}
    {step === 1 && <FormCard title={`${operator}信息`} note={`${operator}需与营业执照登记信息一致。`}><ImagePair first={form.idBack} second={form.idFront} firstLabel="国徽面" secondLabel="人像面" setFirst={(value) => set('idBack', value)} setSecond={(value) => set('idFront', value)} onFirstFile={(file) => setMediaFiles((current) => ({ ...current, back: file }))} onSecondFile={(file) => setMediaFiles((current) => ({ ...current, front: file }))} /><TextField label={`${operator}姓名`} value={form.operatorName} onChange={(value) => set('operatorName', value)} placeholder={`请输入${operator}姓名`} maxLength={20} /><TextField label={`${operator}身份证号`} value={form.citizenId} onChange={(value) => set('citizenId', value)} placeholder="请输入身份证号" maxLength={18} hint="需与证件保持一致" /></FormCard>}
    {step === 2 && <><FormCard title="联系人" note="用于审核结果通知与协议签署联系。"><TextField label="联系人姓名" value={form.contactName} onChange={(value) => set('contactName', value)} placeholder="请输入联系人姓名" maxLength={20} /><TextField label="手机号" value={form.contactPhone} onChange={(value) => set('contactPhone', value)} placeholder="请输入手机号" inputMode="tel" maxLength={11} /></FormCard><FormCard title="经营辅助资料"><TakeoutOrderUpload value={form.takeoutOrder} onChange={(value) => set('takeoutOrder', value)} onError={setError} /></FormCard></>}
    {step === 3 && <FormCard title="确认资料" note="提交后进入平台审核；审核期间资料不可修改。"><div className="seller-contract-v2-review"><ReviewRow label="主体类型" value={form.entityType === 'company' ? '企业' : '个体工商户'} onEdit={() => setStep(0)} /><ReviewRow label="主体名称" value={form.companyName} onEdit={() => setStep(0)} /><ReviewRow label="统一社会信用代码" value={maskValue(form.licenseNo, 4, 4)} onEdit={() => setStep(0)} /><ReviewRow label="营业执照" value="已选择 1 张" onEdit={() => setStep(0)} /><ReviewRow label={`${operator}姓名`} value={form.operatorName} onEdit={() => setStep(1)} /><ReviewRow label={`${operator}身份证号`} value={maskValue(form.citizenId, 4, 4)} onEdit={() => setStep(1)} /><ReviewRow label={`${operator}身份证` } value="已选择 2 张" onEdit={() => setStep(1)} /><ReviewRow label="联系人" value={form.contactName} onEdit={() => setStep(2)} /><ReviewRow label="手机号" value={maskValue(form.contactPhone, 3, 4)} onEdit={() => setStep(2)} /><ReviewRow label="订单截图" value="已生成媒体凭证" onEdit={() => setStep(2)} /></div></FormCard>}
  </ApplicationShell>
}

function ReviewCard({ subject, form, setStep }: { subject: string; form: PersonalForm; setStep: (step: number) => void }) {
  return <FormCard title="确认资料" note="提交后进入平台审核；审核期间资料不可修改。"><div className="seller-contract-v2-review"><ReviewRow label="主体类型" value={subject} /><ReviewRow label="姓名" value={form.realName} onEdit={() => setStep(0)} /><ReviewRow label="身份证号" value={maskValue(form.citizenId, 4, 4)} onEdit={() => setStep(0)} /><ReviewRow label="联系人" value={form.contactName} onEdit={() => setStep(1)} /><ReviewRow label="手机号" value={maskValue(form.contactPhone, 3, 4)} onEdit={() => setStep(1)} /><ReviewRow label="紧急联系人" value={form.emergencyName} onEdit={() => setStep(1)} /><ReviewRow label="识别地址" value={form.identifiedAddress} onEdit={() => setStep(1)} /><ReviewRow label="证件" value="已选择 2 张" onEdit={() => setStep(0)} /><ReviewRow label="订单截图" value="已生成媒体凭证" onEdit={() => setStep(1)} /></div></FormCard>
}

function ApplicationShell({ title, flowStep, onBack, onSubmit, error, footerLabel, onNext, submitting = false, children }: { title: string; flowStep: number; onBack: () => void; onSubmit: (event: FormEvent) => void; error: string; footerLabel: string; onNext?: () => void; submitting?: boolean; children: ReactNode }) {
  const formId = useId()
  return <main className="seller-contract-v2-page"><SellerTopBar title={title} onBack={onBack} /><form id={formId} className="seller-contract-v2-scroll seller-contract-v2-application" onSubmit={onSubmit} noValidate><FlowProgress step={flowStep} />{children}<p className="seller-contract-v2-privacy"><ShieldCheck size={15} />敏感表单内容仅保留在本页内存中，不写入本地存储或日志。</p>{error && <FormError message={error} />}<div className="seller-contract-v2-footer-space" /></form><FixedFooter hint={flowStep === 3 ? '下一步进入平台审核' : '敏感资料不会保存为本地草稿'}><button className="dark" form={formId} type={onNext ? 'button' : 'submit'} disabled={submitting} onClick={onNext ? (event) => advanceSellerApplicationStep(event.nativeEvent, onNext) : undefined}>{submitting ? '提交中…' : footerLabel}</button></FixedFooter></main>
}

function maskValue(value: string, leading: number, trailing: number) {
  if (value.length <= leading + trailing) return '—'
  return `${value.slice(0, leading)}${'*'.repeat(Math.min(6, value.length - leading - trailing))}${value.slice(-trailing)}`
}
