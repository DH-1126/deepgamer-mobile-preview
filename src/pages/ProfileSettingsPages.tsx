import { useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  Apple,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Eye,
  EyeOff,
  FileText,
  Headphones,
  Info,
  Link2,
  LockKeyhole,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Unlink,
  UserRoundX,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import { authRepository } from '../repository/authRepository'
import '../styles/profile-settings-v2.css'

const PERSONALIZATION_KEY = 'deepgamer.personalization.v1'
const PASSWORD_UPDATED_KEY = 'deepgamer.profile.password-updated.v1'
const THIRD_PARTY_KEY = 'deepgamer.profile.third-party-bindings.v1'

type ThirdPartyProvider = 'wechat' | 'qq' | 'apple'
type ThirdPartyBindings = Record<ThirdPartyProvider, boolean>

const defaultBindings: ThirdPartyBindings = { wechat: true, qq: false, apple: false }

function readBoolean(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : raw === 'true'
  } catch {
    return fallback
  }
}

function writeBoolean(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value))
    return true
  } catch {
    return false
  }
}

function readText(key: string) {
  if (typeof window === 'undefined') return ''
  try { return window.localStorage.getItem(key) ?? '' } catch { return '' }
}

function writeText(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function readBindings(): ThirdPartyBindings {
  if (typeof window === 'undefined') return { ...defaultBindings }
  try {
    const parsed = JSON.parse(window.localStorage.getItem(THIRD_PARTY_KEY) ?? '{}') as Partial<ThirdPartyBindings>
    return {
      wechat: typeof parsed.wechat === 'boolean' ? parsed.wechat : defaultBindings.wechat,
      qq: typeof parsed.qq === 'boolean' ? parsed.qq : defaultBindings.qq,
      apple: typeof parsed.apple === 'boolean' ? parsed.apple : defaultBindings.apple,
    }
  } catch {
    return { ...defaultBindings }
  }
}

function writeBindings(value: ThirdPartyBindings) {
  try {
    window.localStorage.setItem(THIRD_PARTY_KEY, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function ProfileSettingsStatusBar() {
  return <div className="profile-settings-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
}

function ProfileSettingsTopBar({ title, support = false }: { title: string; support?: boolean }) {
  const navigate = useNavigate()
  return <><ProfileSettingsStatusBar /><header className="profile-settings-v2-topbar"><button type="button" onClick={() => navigate(-1)} aria-label="返回"><ChevronLeft size={25} strokeWidth={2} aria-hidden="true" /></button><h1>{title}</h1>{support ? <Link to={SUPPORT_CONVERSATION_ROUTE} aria-label="联系客服"><Headphones size={19} aria-hidden="true" /></Link> : <span />}</header></>
}

function SettingsRow({ icon, label, detail, to, arrow = true }: { icon: React.ReactNode; label: string; detail?: string; to: string; arrow?: boolean }) {
  return <Link className="profile-settings-v2-row" to={to}><span className="profile-settings-v2-row-icon" aria-hidden="true">{icon}</span><b>{label}</b>{detail && <small>{detail}</small>}{arrow && <ChevronRight size={17} aria-hidden="true" />}</Link>
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button className={`profile-settings-v2-switch${checked ? ' on' : ''}`} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><em>{checked ? '开' : '关'}</em><span aria-hidden="true" /></button>
}

export function AccountSettingsPage() {
  const [personalized, setPersonalized] = useState(() => readBoolean(PERSONALIZATION_KEY, true))
  const [toast, setToast] = useState('')
  const passwordUpdatedAt = readText(PASSWORD_UPDATED_KEY)
  const changePersonalization = () => {
    const next = !personalized
    setPersonalized(next)
    setToast(writeBoolean(PERSONALIZATION_KEY, next) ? `个性化推荐已${next ? '开启' : '关闭'}` : '设置保存失败，请重试')
  }
  return <main className="profile-settings-v2-page">
    <ProfileSettingsTopBar title="设置" />
    <div className="profile-settings-v2-scroll">
      <section className="profile-settings-v2-list" aria-label="账号设置">
        <div className="profile-settings-v2-row static"><span className="profile-settings-v2-row-icon" aria-hidden="true"><Phone size={18} /></span><b>手机号</b><small>187 **** 0033</small></div>
        <SettingsRow icon={<LockKeyhole size={18} />} label="登录密码" detail={passwordUpdatedAt ? '已更新' : '已设置'} to="/settings/password" />
        <SettingsRow icon={<Link2 size={18} />} label="三方账号绑定" to="/settings/bindings" />
        <div className="profile-settings-v2-row"><span className="profile-settings-v2-row-icon" aria-hidden="true"><Sparkles size={18} /></span><b>个性化设置</b><Switch checked={personalized} onChange={changePersonalization} label={`${personalized ? '关闭' : '开启'}个性化推荐`} /></div>
      </section>
      <section className="profile-settings-v2-list profile-settings-v2-separated-list" aria-label="账号管理"><SettingsRow icon={<UserRoundX size={18} />} label="账号注销" to="/settings/cancellation" arrow={false} /></section>
      <p className="profile-settings-v2-footnote">个性化设置仅影响内容推荐，不影响基础交易服务。</p>
    </div>
    {toast && <div className="profile-settings-v2-toast" role="status" onAnimationEnd={() => setToast('')}>{toast}</div>}
  </main>
}

export function PasswordSettingsPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (password.length < 8) { setError('密码至少需要 8 个字符'); return }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) { setError('密码需同时包含字母和数字'); return }
    if (password !== confirmation) { setError('两次输入的密码不一致'); return }
    if (!writeText(PASSWORD_UPDATED_KEY, new Date().toISOString())) { setError('更新状态保存失败，请重试'); return }
    setPassword('')
    setConfirmation('')
    navigate('/settings', { replace: true, state: { passwordUpdated: true } })
  }
  return <main className="profile-settings-v2-page">
    <ProfileSettingsTopBar title="修改登录密码" support />
    <form className="profile-settings-v2-scroll profile-settings-v2-form" onSubmit={submit} noValidate>
      <section className="profile-settings-v2-form-card">
        <header><span><LockKeyhole size={21} aria-hidden="true" /></span><div><h2>设置新密码</h2><p>用于手机号与密码登录</p></div></header>
        <label><span>新密码</span><div><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} placeholder="8–20 位，包含字母和数字" maxLength={20} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
        <label><span>确认新密码</span><div><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError('') }} placeholder="请再次输入新密码" maxLength={20} /></div></label>
      </section>
      <p className="profile-settings-v2-security-note"><ShieldCheck size={16} aria-hidden="true" />原型仅记录“密码已更新”状态，不会保存输入的密码。</p>
      {error && <p className="profile-settings-v2-error" role="alert">{error}</p>}
      <button className="profile-settings-v2-primary" type="submit">确认修改</button>
    </form>
  </main>
}

const providerMeta: Array<{ id: ThirdPartyProvider; label: string; detail: string; icon: React.ReactNode }> = [
  { id: 'wechat', label: '微信', detail: '用于快捷登录', icon: <MessageCircle size={19} /> },
  { id: 'qq', label: 'QQ', detail: '用于快捷登录', icon: <CircleUserRound size={19} /> },
  { id: 'apple', label: 'Apple', detail: '用于 Apple 设备登录', icon: <Apple size={19} /> },
]

export function ThirdPartyBindingsPage() {
  const [bindings, setBindings] = useState(readBindings)
  const [confirming, setConfirming] = useState<ThirdPartyProvider | null>(null)
  const [toast, setToast] = useState('')
  const update = (id: ThirdPartyProvider, bound: boolean) => {
    const next = { ...bindings, [id]: bound }
    setBindings(next)
    setConfirming(null)
    setToast(writeBindings(next) ? `${providerMeta.find((item) => item.id === id)?.label ?? ''}已${bound ? '绑定' : '解绑'}` : '绑定状态保存失败')
  }
  const target = confirming ? providerMeta.find((item) => item.id === confirming) : undefined
  return <main className="profile-settings-v2-page">
    <ProfileSettingsTopBar title="三方账号绑定" support />
    <div className="profile-settings-v2-scroll">
      <section className="profile-settings-v2-bindings" aria-label="可绑定的三方账号">{providerMeta.map((provider) => <div key={provider.id}><span className={`provider ${provider.id}`} aria-hidden="true">{provider.icon}</span><span><b>{provider.label}</b><small>{provider.detail}</small></span><button type="button" className={bindings[provider.id] ? 'bound' : ''} onClick={() => bindings[provider.id] ? setConfirming(provider.id) : update(provider.id, true)}>{bindings[provider.id] ? '已绑定' : '去绑定'}</button></div>)}</section>
      <p className="profile-settings-v2-footnote">此页为交互原型，绑定与解绑不会调用微信、QQ 或 Apple 服务。</p>
    </div>
    {target && confirming && <div className="profile-settings-v2-modal" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="unbind-title"><span><Unlink size={22} aria-hidden="true" /></span><h2 id="unbind-title">解绑{target.label}？</h2><p>解绑后将无法使用{target.label}快捷登录，但不影响手机号登录。</p><footer><button type="button" onClick={() => setConfirming(null)}>取消</button><button type="button" className="primary" onClick={() => update(confirming, false)}>确认解绑</button></footer></section></div>}
    {toast && <div className="profile-settings-v2-toast" role="status" onAnimationEnd={() => setToast('')}>{toast}</div>}
  </main>
}

export function AccountCancellationPage() {
  const navigate = useNavigate()
  const [agreed, setAgreed] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')
  const exitDemoAccount = () => {
    if (!authRepository.logout()) { setConfirming(false); setError('退出失败，请重试'); return }
    navigate('/', { replace: true })
  }
  return <main className="profile-settings-v2-page">
    <ProfileSettingsTopBar title="账号注销" support />
    <div className="profile-settings-v2-scroll profile-settings-v2-cancel">
      <section className="profile-settings-v2-cancel-hero"><span><AlertTriangle size={25} aria-hidden="true" /></span><h2>请谨慎操作</h2><p>注销账号是不可逆操作，正式功能上线后会先校验账号与交易状态。</p></section>
      <section className="profile-settings-v2-risk"><h2>注销后你将失去</h2><ul><li>个人账号与实名信息</li><li>历史订单、售后与回收记录</li><li>收藏、消息和个性化设置</li></ul></section>
      <button className="profile-settings-v2-check" type="button" role="checkbox" aria-checked={agreed} onClick={() => { setAgreed((value) => !value); setError('') }}><i>{agreed && <Check size={14} strokeWidth={3} aria-hidden="true" />}</i><span>我已了解上述风险，并确认继续</span></button>
      {error && <p className="profile-settings-v2-error" role="alert">{error}</p>}
      <button className="profile-settings-v2-danger-button" type="button" onClick={() => agreed ? setConfirming(true) : setError('请先阅读并确认注销风险')}>申请注销</button>
      <p className="profile-settings-v2-demo-note">原型演示不会删除任何账号或交易数据，确认后仅退出当前登录。</p>
    </div>
    {confirming && <div className="profile-settings-v2-modal" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="cancel-account-title"><span className="danger"><AlertTriangle size={22} aria-hidden="true" /></span><h2 id="cancel-account-title">确认演示注销？</h2><p>当前为本地原型，本次操作仅会退出登录，不会删除任何真实数据。</p><footer><button type="button" onClick={() => setConfirming(false)}>取消</button><button type="button" className="danger" onClick={exitDemoAccount}>确认退出</button></footer></section></div>}
  </main>
}

export function PrivacyAgreementCenterPage() {
  return <main className="profile-settings-v2-page">
    <ProfileSettingsTopBar title="隐私与协议" />
    <div className="profile-settings-v2-scroll">
      <section className="profile-settings-v2-list" aria-label="隐私与协议列表">
        <SettingsRow icon={<ShieldCheck size={18} />} label="隐私协议" to="/privacy-policy" />
        <SettingsRow icon={<FileText size={18} />} label="用户协议" to="/user-agreement" />
        <SettingsRow icon={<Info size={18} />} label="关于我们" to="/about-us" />
      </section>
    </div>
  </main>
}

export function AboutUsPage() {
  const version = useMemo(() => '版本 1.2.0', [])
  return <main className="profile-settings-v2-page">
    <ProfileSettingsTopBar title="关于我们" />
    <div className="profile-settings-v2-scroll profile-settings-v2-about">
      <section className="profile-settings-v2-brand-card"><span aria-hidden="true">DG</span><h2>深度玩家</h2><p>专注于提供安全、清晰、可追踪的游戏账号交易与回收体验。</p><small>{version}</small></section>
      <section className="profile-settings-v2-list"><Link className="profile-settings-v2-row" to={SUPPORT_CONVERSATION_ROUTE}><span className="profile-settings-v2-row-icon" aria-hidden="true"><Headphones size={18} /></span><b>联系客服</b><small>在线咨询</small><ChevronRight size={17} aria-hidden="true" /></Link></section>
      <p className="profile-settings-v2-copyright">© 2026 深度玩家<br />页面信息仅供产品原型演示</p>
    </div>
  </main>
}
