import { useId, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  BadgePercent,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  Headphones,
  IdCard,
  ShieldCheck,
  Upload,
  UserRound,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import {
  createSubmittedSellerApplication,
  emptySellerApplication,
  isBusinessLicense,
  isChineseName,
  isCitizenId,
  isMainlandPhone,
  type SellerApplicationSnapshot,
  type SellerSubject,
} from '../components/sellerContractModel'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import '../styles/seller-contract-v2.css'

const SELLER_APPLICATION_KEY = 'deepgamer.seller-application.v1'

function readSellerApplication(): SellerApplicationSnapshot {
  if (typeof window === 'undefined') return emptySellerApplication
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SELLER_APPLICATION_KEY) ?? '{}') as Partial<SellerApplicationSnapshot>
    if (parsed.status === 'under_review' && (parsed.subject === 'personal' || parsed.subject === 'business')) return { status: parsed.status, subject: parsed.subject, submittedAt: parsed.submittedAt }
  } catch { /* Fall back to the not-started state. */ }
  return emptySellerApplication
}

function writeSellerApplication(value: SellerApplicationSnapshot) {
  try { window.localStorage.setItem(SELLER_APPLICATION_KEY, JSON.stringify(value)); return true } catch { return false }
}

function SellerStatusBar() {
  return <div className="seller-contract-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
}

function SellerTopBar({ title, support = false }: { title: string; support?: boolean }) {
  const navigate = useNavigate()
  return <><SellerStatusBar /><header className="seller-contract-v2-topbar"><button type="button" onClick={() => navigate(-1)} aria-label="返回"><ChevronLeft size={25} strokeWidth={2} aria-hidden="true" /></button><h1>{title}</h1>{support ? <Link to={SUPPORT_CONVERSATION_ROUTE} aria-label="联系客服"><Headphones size={19} aria-hidden="true" /></Link> : <span />}</header></>
}

export function SellerCenterPage() {
  const [snapshot] = useState(readSellerApplication)
  const [rightsOpen, setRightsOpen] = useState(false)
  const reviewing = snapshot.status === 'under_review'
  const subjectLabel = snapshot.subject === 'personal' ? '个人' : snapshot.subject === 'business' ? '企业/个体户' : '未选择'
  return <main className="seller-contract-v2-page">
    <SellerTopBar title="卖家签约" support />
    <div className="seller-contract-v2-scroll seller-contract-v2-center">
      <section className={`seller-contract-v2-status-card${reviewing ? ' reviewing' : ''}`} aria-label="卖家签约状态">
        <header><span>{reviewing ? '审核中' : '未开通'}</span><h2>{reviewing ? '卖家资料审核中' : '未开通卖家身份'}</h2><em>{reviewing ? '资料已提交' : '暂无资料'}</em></header>
        <div><span><small>卖家权益</small><b>{reviewing ? '基础卖家' : '未开通卖家身份'}</b></span><span><small>主体类型</small><b>{subjectLabel}</b></span><span><small>申请状态</small><b>{reviewing ? '平台审核中' : '未开通'}</b></span><span><small>签约状态</small><b>待签约</b></span></div>
        <p>{reviewing ? '平台将在 1 个工作日内完成审核，审核通过后将发送签约通知。' : '选择适合的主体，提交资料后等待审核和签约。'}</p>
      </section>

      <section className="seller-contract-v2-benefit"><span><BadgePercent size={22} aria-hidden="true" /></span><div><h2>签约享卖家专属费率</h2><p>基础卖家按适用权益与费率结算，具体以审核结果及合同约定为准。</p></div><em>减免手续费</em></section>

      <section className="seller-contract-v2-section" aria-labelledby="seller-subject-title"><h2 id="seller-subject-title">申请主体</h2><div className="seller-contract-v2-subjects">
        <Link to="/seller/apply/personal"><span><UserRound size={23} aria-hidden="true" /></span><div><b>个人</b><small>适合自然人卖家，提交身份证及联系人资料。</small></div><em>{snapshot.subject === 'personal' ? '继续填写' : '去申请'}</em><ChevronRight size={18} aria-hidden="true" /></Link>
        <Link to="/seller/apply/business"><span><Building2 size={23} aria-hidden="true" /></span><div><b>企业/个体户</b><small>适合持营业执照的企业或个体工商户。</small></div><em>{snapshot.subject === 'business' ? '继续填写' : '去申请'}</em><ChevronRight size={18} aria-hidden="true" /></Link>
      </div></section>

      <section className="seller-contract-v2-section"><h2>签约说明</h2><button className="seller-contract-v2-explain" type="button" onClick={() => setRightsOpen(true)}><span><FileText size={20} aria-hidden="true" /></span><div><b>查看卖家权益与签约说明</b><small>了解基础卖家、VIP 卖家及不同主体的适用规则。</small></div><ChevronRight size={18} aria-hidden="true" /></button></section>
    </div>
    {rightsOpen && <div className="seller-contract-v2-modal"><button type="button" aria-label="关闭签约说明" onClick={() => setRightsOpen(false)} /><section role="dialog" aria-modal="true" aria-labelledby="seller-rights-title"><i /><header><h2 id="seller-rights-title">卖家权益与签约说明</h2><button type="button" onClick={() => setRightsOpen(false)} aria-label="关闭">×</button></header><div><article><b>基础卖家</b><p>个人、个体户或企业主体均可申请。审核并签约后，按基础卖家权益与适用费率结算。</p></article><article><b>VIP 卖家</b><p>面向高频或合作卖家，完成基础卖家签约后，由平台运营协助确认权益与合同。</p></article><article><b>主体说明</b><p>主体类型用于资料审核与协议签署，不直接决定基础卖家或 VIP 卖家权益。</p></article><small>最终权益、费率和责任以审核结果及正式合同为准。</small></div></section></div>}
  </main>
}

type UploadFieldProps = { label: string; hint: string; value: string; onChange: (value: string) => void }

function UploadField({ label, hint, value, onChange }: UploadFieldProps) {
  const id = useId()
  return <label className={`seller-contract-v2-upload${value ? ' selected' : ''}`} htmlFor={id}><input id={id} type="file" accept="image/jpeg,image/png" onChange={(event) => onChange(event.target.files?.[0]?.name ?? '')} /><span><Upload size={20} aria-hidden="true" /></span><div><b>{label}<em>*</em></b><small>{value || hint}</small></div>{value ? <Check size={18} aria-label="已选择" /> : <strong>选择图片</strong>}</label>
}

function TextField({ label, value, onChange, placeholder, hint, inputMode = 'text', maxLength = 60 }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; hint?: string; inputMode?: 'text' | 'numeric' | 'tel'; maxLength?: number }) {
  return <label className="seller-contract-v2-field"><span>{label}<em>*</em></span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} />{hint && <small>{hint}</small>}</label>
}

function SellerSteps({ steps, current, onSelect }: { steps: Array<[string, string]>; current: number; onSelect: (step: number) => void }) {
  return <section className="seller-contract-v2-steps" aria-label="签约步骤">{steps.map(([title, detail], index) => <button type="button" key={title} className={index === current ? 'active' : index < current ? 'done' : ''} disabled={index > current} onClick={() => onSelect(index)}><span>{index < current ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : index + 1}</span><b>{title}</b><small>{detail}</small>{index < steps.length - 1 && <i />}</button>)}</section>
}

function Agreement({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <button type="button" className="seller-contract-v2-agreement" role="checkbox" aria-checked={checked} onClick={onChange}><i>{checked && <Check size={14} strokeWidth={3} aria-hidden="true" />}</i><span>我已核对资料真实准确，并同意<Link to="/user-agreement" onClick={(event) => event.stopPropagation()}>《买卖家服务协议》</Link></span></button>
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="seller-contract-v2-review-row"><span>{label}</span><b>{value}</b></div>
}

function FormSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="seller-contract-v2-form-card"><header><span>{icon}</span><h2>{title}</h2></header>{children}</section>
}

type PersonalForm = { idFront: string; idBack: string; realName: string; citizenId: string; contactPhone: string; emergencyName: string; emergencyPhone: string; address: string }

export function PersonalSellerContractPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<PersonalForm>({ idFront: '', idBack: '', realName: '', citizenId: '', contactPhone: '', emergencyName: '', emergencyPhone: '', address: '' })
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof PersonalForm>(key: K, value: PersonalForm[K]) => { setForm((current) => ({ ...current, [key]: value })); setError('') }
  const next = () => {
    if (step === 0) {
      if (!form.idFront || !form.idBack) return setError('请先选择身份证人像面和国徽面图片')
      if (!isChineseName(form.realName)) return setError('请输入正确的真实姓名')
      if (!isCitizenId(form.citizenId)) return setError('请输入正确的 18 位身份证号')
    }
    if (step === 1) {
      if (!isMainlandPhone(form.contactPhone)) return setError('请输入正确的联系人手机号')
      if (!isChineseName(form.emergencyName)) return setError('请输入正确的紧急联系人姓名')
      if (!isMainlandPhone(form.emergencyPhone)) return setError('请输入正确的紧急联系人电话')
      if (form.address.trim().length < 5) return setError('请填写常用联系地址')
    }
    setError(''); setStep((current) => Math.min(2, current + 1))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!agreed) return setError('请先核对资料并同意买卖家服务协议')
    if (!writeSellerApplication(createSubmittedSellerApplication('personal'))) return setError('提交状态保存失败，请重试')
    navigate('/seller/center', { replace: true })
  }
  return <SellerApplicationLayout title="个人卖家签约" steps={[["实名信息", "身份证"], ["联系人", "联系资料"], ["确认提交", "等待审核"]]} step={step} onStep={setStep} error={error} onBack={step > 0 ? () => { setStep((current) => current - 1); setError('') } : undefined} onNext={step < 2 ? next : undefined} onSubmit={submit}>
    {step === 0 && <FormSection title="身份证与实名认证" icon={<IdCard size={21} aria-hidden="true" />}><p className="seller-contract-v2-form-note">身份证图片仅用于卖家审核、实名核验与签约资料归档。</p><div className="seller-contract-v2-upload-grid"><UploadField label="身份证人像面" hint="上传后识别姓名和身份证号" value={form.idFront} onChange={(value) => set('idFront', value)} /><UploadField label="身份证国徽面" hint="请保证证件信息完整清晰" value={form.idBack} onChange={(value) => set('idBack', value)} /></div><TextField label="卖家真实姓名" value={form.realName} onChange={(value) => set('realName', value)} placeholder="请输入真实姓名" maxLength={20} /><TextField label="卖家身份证号" value={form.citizenId} onChange={(value) => set('citizenId', value)} placeholder="请输入 18 位身份证号" maxLength={18} /></FormSection>}
    {step === 1 && <ContactSection phoneLabel="联系人手机号（接收签约短信）" values={form} setValue={(key, value) => set(key as keyof PersonalForm, value)} />}
    {step === 2 && <FormSection title="确认提交资料" icon={<FileCheck2 size={21} aria-hidden="true" />}><p className="seller-contract-v2-form-note">请确认以下信息与证件一致。提交后平台将在 1 个工作日内完成审核。</p><div className="seller-contract-v2-review"><ReviewRow label="申请主体" value="个人" /><ReviewRow label="真实姓名" value={form.realName} /><ReviewRow label="身份证号" value={maskId(form.citizenId)} /><ReviewRow label="联系人手机号" value={maskPhone(form.contactPhone)} /><ReviewRow label="证件资料" value="已选择 2 张" /></div><Agreement checked={agreed} onChange={() => { setAgreed((value) => !value); setError('') }} /></FormSection>}
  </SellerApplicationLayout>
}

type BusinessForm = { license: string; companyName: string; licenseNo: string; entityType: 'individual' | 'company' | ''; idFront: string; idBack: string; operatorName: string; citizenId: string; contactPhone: string; emergencyName: string; emergencyPhone: string; address: string }

export function BusinessSellerContractPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<BusinessForm>({ license: '', companyName: '', licenseNo: '', entityType: '', idFront: '', idBack: '', operatorName: '', citizenId: '', contactPhone: '', emergencyName: '', emergencyPhone: '', address: '' })
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof BusinessForm>(key: K, value: BusinessForm[K]) => { setForm((current) => ({ ...current, [key]: value })); setError('') }
  const next = () => {
    if (step === 0) {
      if (!form.license) return setError('请先选择营业执照图片')
      if (form.companyName.trim().length < 2) return setError('请输入正确的企业或个体户名称')
      if (!isBusinessLicense(form.licenseNo)) return setError('请输入正确的营业执照号码')
      if (!form.entityType) return setError('请选择个体工商户或企业')
    }
    if (step === 1) {
      if (!form.idFront || !form.idBack) return setError('请先选择经营者/法人身份证图片')
      if (!isChineseName(form.operatorName)) return setError(`请输入正确的${form.entityType === 'company' ? '法人' : '经营者'}姓名`)
      if (!isCitizenId(form.citizenId)) return setError('请输入正确的 18 位身份证号')
    }
    if (step === 2) {
      if (!isMainlandPhone(form.contactPhone)) return setError('请输入正确的联系人手机号')
      if (!isChineseName(form.emergencyName)) return setError('请输入正确的紧急联系人姓名')
      if (!isMainlandPhone(form.emergencyPhone)) return setError('请输入正确的紧急联系人手机号')
      if (form.address.trim().length < 5) return setError('请填写常用联系地址')
    }
    setError(''); setStep((current) => Math.min(3, current + 1))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!agreed) return setError('请先核对资料并同意买卖家服务协议')
    if (!writeSellerApplication(createSubmittedSellerApplication('business'))) return setError('提交状态保存失败，请重试')
    navigate('/seller/center', { replace: true })
  }
  const operatorLabel = form.entityType === 'company' ? '法人' : '经营者'
  return <SellerApplicationLayout title="企业卖家签约" steps={[["主体资料", "营业执照"], ["经营者/法人", "身份证"], ["联系人", "联系资料"], ["确认提交", "等待审核"]]} step={step} onStep={setStep} error={error} onBack={step > 0 ? () => { setStep((current) => current - 1); setError('') } : undefined} onNext={step < 3 ? next : undefined} onSubmit={submit}>
    {step === 0 && <FormSection title="企业/个体户信息" icon={<Building2 size={21} aria-hidden="true" />}><p className="seller-contract-v2-form-note">上传营业执照后可识别主体名称和营业执照号码，请以证照信息为准。</p><UploadField label="营业执照" hint="支持 JPG/PNG，请保证四角完整" value={form.license} onChange={(value) => set('license', value)} /><TextField label="企业/个体户名称" value={form.companyName} onChange={(value) => set('companyName', value)} placeholder="请输入营业执照上的主体名称" /><TextField label="营业执照号码" value={form.licenseNo} onChange={(value) => set('licenseNo', value.toUpperCase())} placeholder="统一社会信用代码或注册号" maxLength={24} /><div className="seller-contract-v2-type"><span>请确认主体类型<em>*</em></span><div><button type="button" className={form.entityType === 'individual' ? 'active' : ''} onClick={() => set('entityType', 'individual')}>个体工商户</button><button type="button" className={form.entityType === 'company' ? 'active' : ''} onClick={() => set('entityType', 'company')}>企业</button></div></div></FormSection>}
    {step === 1 && <FormSection title={`${operatorLabel}信息`} icon={<IdCard size={21} aria-hidden="true" />}><p className="seller-contract-v2-form-note">姓名和身份证信息需与营业执照登记的经营者或法人保持一致。</p><div className="seller-contract-v2-upload-grid"><UploadField label="身份证人像面" hint={`选择${operatorLabel}身份证人像面`} value={form.idFront} onChange={(value) => set('idFront', value)} /><UploadField label="身份证国徽面" hint={`选择${operatorLabel}身份证国徽面`} value={form.idBack} onChange={(value) => set('idBack', value)} /></div><TextField label={`${operatorLabel}姓名`} value={form.operatorName} onChange={(value) => set('operatorName', value)} placeholder={`请输入${operatorLabel}姓名`} maxLength={20} /><TextField label={`${operatorLabel}身份证号`} value={form.citizenId} onChange={(value) => set('citizenId', value)} placeholder="请输入 18 位身份证号" maxLength={18} /></FormSection>}
    {step === 2 && <ContactSection phoneLabel="联系人手机号（接收签约短信）" values={form} setValue={(key, value) => set(key as keyof BusinessForm, value)} />}
    {step === 3 && <FormSection title="确认提交资料" icon={<FileCheck2 size={21} aria-hidden="true" />}><p className="seller-contract-v2-form-note">资料提交后平台将按主体材料与认证结果审核，审核通过后发送签约通知。</p><div className="seller-contract-v2-review"><ReviewRow label="申请主体" value={form.entityType === 'company' ? '企业' : '个体工商户'} /><ReviewRow label="主体名称" value={form.companyName} /><ReviewRow label="营业执照号码" value={maskLicense(form.licenseNo)} /><ReviewRow label={`${operatorLabel}姓名`} value={form.operatorName} /><ReviewRow label="联系人手机号" value={maskPhone(form.contactPhone)} /></div><Agreement checked={agreed} onChange={() => { setAgreed((value) => !value); setError('') }} /></FormSection>}
  </SellerApplicationLayout>
}

function ContactSection({ phoneLabel, values, setValue }: { phoneLabel: string; values: { contactPhone: string; emergencyName: string; emergencyPhone: string; address: string }; setValue: (key: 'contactPhone' | 'emergencyName' | 'emergencyPhone' | 'address', value: string) => void }) {
  return <FormSection title="联系人信息" icon={<UserRound size={21} aria-hidden="true" />}><p className="seller-contract-v2-form-note">用于平台审核、签约通知及必要的交易联系。</p><TextField label={phoneLabel} value={values.contactPhone} onChange={(value) => setValue('contactPhone', value)} placeholder="请输入 11 位手机号" inputMode="tel" maxLength={11} /><TextField label="紧急联系人姓名" value={values.emergencyName} onChange={(value) => setValue('emergencyName', value)} placeholder="请输入紧急联系人姓名" maxLength={20} /><TextField label="紧急联系人电话" value={values.emergencyPhone} onChange={(value) => setValue('emergencyPhone', value)} placeholder="请输入紧急联系人电话" inputMode="tel" maxLength={11} /><TextField label="常用联系地址" value={values.address} onChange={(value) => setValue('address', value)} placeholder="请输入省市区及详细地址" /></FormSection>
}

function SellerApplicationLayout({ title, steps, step, onStep, error, onBack, onNext, onSubmit, children }: { title: string; steps: Array<[string, string]>; step: number; onStep: (step: number) => void; error: string; onBack?: () => void; onNext?: () => void; onSubmit: (event: FormEvent) => void; children: ReactNode }) {
  return <main className="seller-contract-v2-page"><SellerTopBar title={title} support /><form className="seller-contract-v2-scroll seller-contract-v2-application" onSubmit={onSubmit} noValidate><SellerSteps steps={steps} current={step} onSelect={onStep} />{children}<p className="seller-contract-v2-privacy"><ShieldCheck size={15} aria-hidden="true" />表单内容仅用于当前签约演示，原型不会保存身份证号、手机号或图片内容。</p>{error && <p className="seller-contract-v2-error" role="alert"><AlertCircle size={15} aria-hidden="true" />{error}</p>}<footer>{onBack && <button type="button" onClick={onBack}>上一步</button>}<button className="primary" type={onNext ? 'button' : 'submit'} onClick={onNext}>{onNext ? '下一步' : '提交审核'}</button></footer></form></main>
}

function maskPhone(value: string) {
  return value.length === 11 ? `${value.slice(0, 3)} **** ${value.slice(-4)}` : '—'
}

function maskId(value: string) {
  return value.length === 18 ? `${value.slice(0, 4)}**********${value.slice(-4)}` : '—'
}

function maskLicense(value: string) {
  return value.length >= 8 ? `${value.slice(0, 4)}****${value.slice(-4)}` : '—'
}
