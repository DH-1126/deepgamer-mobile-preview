import { useState, type FormEvent } from 'react'
import { AlertCircle, Check, CheckCircle2, ChevronLeft, Fingerprint, IdCard, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { maskRealName, maskRealNameId } from '../components/realNameModel'
import { isChineseName, isCitizenId } from '../components/sellerContractModel'
import '../styles/realname-v2.css'

type RealNameState = 'verified' | 'unverified'

function RealNameStatusBar() {
  return <div className="realname-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
}

export function RealNamePage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<RealNameState>('verified')
  const [name, setName] = useState('')
  const [citizenId, setCitizenId] = useState('')
  const [verifiedName, setVerifiedName] = useState('邓*')
  const [verifiedId, setVerifiedId] = useState('4201***********214')
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const verified = status === 'verified'
  const toggleStatus = () => { setStatus((value) => value === 'verified' ? 'unverified' : 'verified'); setError('') }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!isChineseName(name)) return setError('请输入正确的真实姓名')
    if (!isCitizenId(citizenId)) return setError('请输入正确的 18 位身份证号')
    if (!agreed) return setError('请先确认信息真实有效并同意认证说明')
    setVerifiedName(maskRealName(name))
    setVerifiedId(maskRealNameId(citizenId))
    setName(''); setCitizenId(''); setAgreed(false); setError(''); setStatus('verified')
  }
  return <main className="realname-v2-page">
    <RealNameStatusBar />
    <header className="realname-v2-topbar"><button type="button" onClick={() => navigate(-1)} aria-label="返回"><ChevronLeft size={25} strokeWidth={2} aria-hidden="true" /></button><h1>实名认证</h1><span /></header>
    <div className="realname-v2-scroll">
      <section className={`realname-v2-state-card ${verified ? 'verified' : 'unverified'}`} aria-label={`实名认证状态：${verified ? '已实名' : '未实名'}`}>
        <span>{verified ? <CheckCircle2 size={27} aria-hidden="true" /> : <Fingerprint size={27} aria-hidden="true" />}</span>
        <div><h2>{verified ? '实名认证已通过' : '尚未完成实名认证'}</h2><p>{verified ? `${verifiedName} · ${verifiedId}` : '为了你的交易安全，请完成实名认证'}</p></div>
        <button type="button" className="realname-v2-state-switch" onClick={toggleStatus} aria-label={`当前${verified ? '已实名' : '未实名'}，点击切换到${verified ? '未实名' : '已实名'}状态`}>{verified ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <AlertCircle size={13} aria-hidden="true" />}{verified ? '已实名' : '未实名'}</button>
      </section>

      {verified ? <VerifiedContent onBack={() => navigate(-1)} name={verifiedName} id={verifiedId} /> : <form className="realname-v2-form" onSubmit={submit} noValidate>
        <section className="realname-v2-form-card"><header><span><IdCard size={22} aria-hidden="true" /></span><div><h2>填写认证信息</h2><p>请填写本人真实姓名和身份证号</p></div></header><label><span>真实姓名<em>*</em></span><input value={name} onChange={(event) => { setName(event.target.value); setError('') }} placeholder="请输入真实姓名" autoComplete="name" maxLength={20} /></label><label><span>身份证号<em>*</em></span><input value={citizenId} onChange={(event) => { setCitizenId(event.target.value); setError('') }} placeholder="请输入 18 位身份证号" inputMode="text" autoComplete="off" maxLength={18} /></label></section>
        <section className="realname-v2-security"><span><ShieldCheck size={21} aria-hidden="true" /></span><div><h2>认证信息安全保护</h2><p>姓名和身份证号仅用于权威核验，将加密处理并仅以脱敏形式展示。</p></div></section>
        <button className="realname-v2-agreement" type="button" role="checkbox" aria-checked={agreed} onClick={() => { setAgreed((value) => !value); setError('') }}><i>{agreed && <Check size={14} strokeWidth={3} aria-hidden="true" />}</i><span>我确认以上信息真实有效，并同意实名认证说明</span></button>
        {error && <p className="realname-v2-error" role="alert"><AlertCircle size={15} aria-hidden="true" />{error}</p>}
        <button className="realname-v2-primary" type="submit">提交实名认证</button>
        <p className="realname-v2-demo-note">当前为交互原型，不会保存或提交真实身份信息。</p>
      </form>}
    </div>
  </main>
}

function VerifiedContent({ onBack, name, id }: { onBack: () => void; name: string; id: string }) {
  return <>
    <section className="realname-v2-result"><span><Check size={36} strokeWidth={2.5} aria-hidden="true" /></span><h2>认证成功</h2><p>您的实名认证已通过<br />现在可以安全地进行交易</p><button type="button" onClick={onBack}>返回</button></section>
    <section className="realname-v2-info"><header><span><LockKeyhole size={20} aria-hidden="true" /></span><h2>认证信息</h2></header><div><span>真实姓名</span><b>{name}</b></div><div><span>身份证号</span><b>{id}</b></div><p><UserRound size={15} aria-hidden="true" />认证信息仅展示脱敏结果，暂不支持自行修改。</p></section>
  </>
}
