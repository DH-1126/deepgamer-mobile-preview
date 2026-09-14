import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  Apple,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleUserRound,
  Eye,
  EyeOff,
  Headphones,
  MessageCircle,
  ShieldCheck,
  Unlink,
  XCircle,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { hasPasswordErrors, parsePasswordScenario, passwordRequirements, validatePasswordForm, type PasswordMode, type PasswordScenario, type PasswordValidation } from '../components/accountSettingsModel'
import { assetPath } from '../components/assetPath'
import { Button, Cell, Checkbox, Dialog, Heading, IconButton, PageHeader, StatusBar, Toast, ToggleSwitch } from '../components/ui'
import { ProfileFeatureList } from '../components/ProfileFeatureList'
import { useAccountSettings } from '../components/useAccountSettings'
import { DEFAULT_ACCOUNT_PHONE, DEFAULT_NICKNAME } from '../components/profileIdentityModel'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import { accountSettingsRepository } from '../repository/accountSettingsRepository'
import { authRepository } from '../repository/authRepository'
import { getRuntimeStorage } from '../runtime/dataMode'
import '../styles/profile-settings-v2.css'

const THIRD_PARTY_KEY = 'deepgamer.profile.third-party-bindings.v1'

type ThirdPartyProvider = 'wechat' | 'qq' | 'apple'
type ThirdPartyBindings = Record<ThirdPartyProvider, boolean>

const defaultBindings: ThirdPartyBindings = { wechat: true, qq: false, apple: false }

function readBindings(): ThirdPartyBindings {
  if (typeof window === 'undefined') return { ...defaultBindings }
  try {
    const parsed = JSON.parse(getRuntimeStorage().getItem(THIRD_PARTY_KEY) ?? '{}') as Partial<ThirdPartyBindings>
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
    getRuntimeStorage().setItem(THIRD_PARTY_KEY, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function ProfileSettingsTopBar({ title, support = false }: { title: string; support?: boolean }) {
  const navigate = useNavigate()
  return <><StatusBar /><PageHeader className="profile-settings-v2-topbar" title={title} left={<IconButton label="返回" onClick={() => navigate(-1)}><ChevronLeft size={25} strokeWidth={2} aria-hidden="true" /></IconButton>} right={support ? <Link to={SUPPORT_CONVERSATION_ROUTE} aria-label="联系客服"><Headphones size={19} aria-hidden="true" /></Link> : undefined} /></>
}

export function AccountSettingsPage() {
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState(() => accountSettingsRepository.getSnapshot())
  const [cacheSize, setCacheSize] = useState('36.4 MB')
  const [toast, setToast] = useState('')
  useEffect(() => accountSettingsRepository.subscribe(() => setSnapshot(accountSettingsRepository.getSnapshot())), [])
  const changeSwitch = (field: 'smsNotifications' | 'doNotDisturb', label: string) => {
    const next = !snapshot[field]
    if (!accountSettingsRepository.update({ [field]: next })) { setToast('设置保存失败，请重试'); return }
    setSnapshot(accountSettingsRepository.getSnapshot())
    setToast(`${label}已${next ? '开启' : '关闭'}`)
  }
  const logout = () => {
    if (!authRepository.logout()) { setToast('退出失败，请重试'); return }
    navigate('/', { replace: true })
  }
  return <main className="profile-settings-v2-page" data-node-id="4053:8997">
    <ProfileSettingsTopBar title="设置" />
    <div className="profile-settings-v2-scroll profile-settings-v2-overview">
      <Heading variant="group">通知</Heading>
      <section className="profile-settings-v2-list profile-settings-v2-plain-list" aria-label="通知设置">
        <Cell className="profile-settings-v2-cell profile-settings-v2-notice-cell" label="系统通知" description="包含订单信息、商品信息等" value="敬请期待" />
        <Cell className="profile-settings-v2-cell profile-settings-v2-notice-cell" label="短信通知" arrow={false} trailing={<ToggleSwitch checked={snapshot.smsNotifications} onCheckedChange={() => changeSwitch('smsNotifications', '短信通知')} label={`${snapshot.smsNotifications ? '关闭' : '开启'}短信通知`} />} />
        <Cell className="profile-settings-v2-cell profile-settings-v2-notice-cell" label="免打扰" arrow={false} trailing={<ToggleSwitch checked={snapshot.doNotDisturb} onCheckedChange={() => changeSwitch('doNotDisturb', '免打扰')} label={`${snapshot.doNotDisturb ? '关闭' : '开启'}免打扰`} />} />
        <Cell className="profile-settings-v2-cell" label="免打扰时间段" value="00:00 - 09:00" onClick={() => setToast('免打扰时间段暂为 00:00 - 09:00')} />
      </section>

      <Heading variant="group">通用</Heading>
      <section className="profile-settings-v2-list profile-settings-v2-plain-list" aria-label="通用设置">
        <Cell className="profile-settings-v2-cell" label="清除缓存" value={cacheSize} onClick={() => { setCacheSize('0 B'); setToast('缓存已清理') }} />
        <Cell className="profile-settings-v2-cell" label="关于深度玩家" value="v1.0.0" to="/about-us" />
      </section>

      <Button className="profile-settings-v2-logout-layout" variant="outline" size="lg" fullWidth onClick={logout}>退出登录</Button>
    </div>
    <Toast message={toast} onDismiss={() => setToast('')} />
  </main>
}

export function AccountSecurityPage() {
  const settings = useAccountSettings()
  return <main className="profile-settings-v2-page">
    <ProfileSettingsTopBar title="账号与安全" />
    <div className="profile-settings-v2-scroll profile-settings-v2-overview">
      <Heading variant="group">账号</Heading>
      <section className="profile-settings-v2-list profile-settings-v2-plain-list" aria-label="账号设置">
        <Cell className="profile-settings-v2-cell" label="头像与昵称" value={settings.nickname || DEFAULT_NICKNAME} to="/account-security/profile" />
        <Cell className="profile-settings-v2-cell" label="手机号" value={settings.maskedPhone || DEFAULT_ACCOUNT_PHONE} to="/account-security/phone" />
        <Cell className="profile-settings-v2-cell" label="登录密码" value="已设置" to="/settings/password" />
      </section>
    </div>
    <footer className="profile-settings-v2-security-footer"><Link className="profile-settings-v2-cancel-link" to="/settings/cancellation">注销账号</Link></footer>
  </main>
}

export function PasswordSettingsPage() {
  const navigate = useNavigate()
  const settings = useAccountSettings()
  const maskedPhone = settings.maskedPhone || DEFAULT_ACCOUNT_PHONE
  const { search } = useLocation()
  const initialScenario = parsePasswordScenario(new URLSearchParams(search).get('scenario'))
  const [mode, setMode] = useState<PasswordMode>(new URLSearchParams(search).get('mode') === 'change' ? 'change' : 'setup')
  const [currentPassword, setCurrentPassword] = useState('')
  const prefilled = initialScenario !== 'fill'
  const [scenario, setScenario] = useState<PasswordScenario>(initialScenario)
  const [password, setPassword] = useState(prefilled ? (initialScenario === 'validation' ? '12345' : 'Abcd123456') : '')
  const [confirmation, setConfirmation] = useState(prefilled ? (initialScenario === 'validation' ? '1234' : 'Abcd123456') : '')
  const [code, setCode] = useState(prefilled && initialScenario !== 'validation' ? '8241' : '')
  const [countdown, setCountdown] = useState(prefilled ? 59 : 0)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<PasswordValidation>(() => initialScenario === 'validation' ? validatePasswordForm('12345', '1234', '') : {})
  const outcome = new URLSearchParams(search).get('outcome')
  const checks = passwordRequirements(password, confirmation)

  useEffect(() => {
    if (countdown <= 0) return undefined
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [countdown])
  useEffect(() => {
    if (scenario !== 'submitting') return undefined
    if (initialScenario === 'submitting') return undefined
    const timer = window.setTimeout(() => {
      if (outcome === 'failure') { setScenario('failure'); return }
      if (!accountSettingsRepository.markPasswordUpdated()) { setScenario('failure'); return }
      setCurrentPassword(''); setPassword(''); setConfirmation(''); setCode(''); setScenario('success')
    }, 850)
    return () => window.clearTimeout(timer)
  }, [initialScenario, outcome, scenario])

  useEffect(() => {
    if (scenario !== 'success' || initialScenario === 'success') return undefined
    const timer = window.setTimeout(() => navigate('/profile', { replace: true }), 1200)
    return () => window.clearTimeout(timer)
  }, [initialScenario, navigate, scenario])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = validatePasswordForm(password, confirmation, code, { mode, currentPassword })
    setErrors(next)
    if (hasPasswordErrors(next)) return
    setScenario('confirm')
  }
  const changePassword = (value: string) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })) }
  const changeConfirmation = (value: string) => { setConfirmation(value); setErrors((current) => ({ ...current, confirmation: undefined })) }
  const changeCode = (value: string) => { setCode(value.replace(/\D/g, '').slice(0, 4)); setErrors((current) => ({ ...current, code: undefined })) }
  const resend = () => { setCountdown(59); setErrors((current) => ({ ...current, code: undefined })) }
  const returnToProfile = () => navigate('/profile', { replace: true })
  const switchMode = () => {
    setMode(current => current === 'setup' ? 'change' : 'setup')
    setCurrentPassword(''); setErrors({}); setScenario('fill'); setShowPassword(false)
  }
  const actionName = mode === 'change' ? '修改' : '设置'

  const passwordNodeId = scenario === 'countdown' ? '4053:8649' : scenario === 'validation' ? '4053:8751' : scenario === 'success' ? '4053:8924' : '4053:8561'
  return <main className="profile-settings-v2-page profile-settings-v2-password" data-password-mode={mode} data-scenario={scenario} data-node-id={passwordNodeId}>
    <ProfileSettingsTopBar title={`${actionName}密码`} />
    {scenario === 'success' ? <div className="profile-settings-v2-scroll profile-settings-v2-password-success">
      <section><span><CheckCircle2 size={40} strokeWidth={2.2} aria-hidden="true" /></span><Heading as="h2" variant="section">密码{actionName}成功</Heading><p>即将返回我的页面</p></section>
      <dl><div><dt>当前账号</dt><dd>{maskedPhone}</dd></div><div><dt>修改时间</dt><dd>09-10 16:08</dd></div></dl>
      <button type="button" onClick={returnToProfile}>返回我的</button>
    </div> : <form className="profile-settings-v2-scroll profile-settings-v2-form" onSubmit={submit} noValidate>
      <header className="profile-settings-v2-password-intro"><Heading as="h2" variant="section"><Button className="profile-settings-v2-mode-switch" variant="ghost" onClick={switchMode} aria-label={mode === 'setup' ? '设置新密码，点击切换为修改密码' : '修改密码，点击切换为设置新密码'}>{mode === 'setup' ? '设置新密码' : '修改密码'}</Button></Heading><p>当前账号　<b>{maskedPhone}</b></p></header>
      <section className="profile-settings-v2-form-card password-fields">
        {mode === 'change' && <label><span>原密码</span><div className={errors.currentPassword ? 'invalid' : ''}><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setErrors((current) => ({ ...current, currentPassword: undefined })) }} placeholder="请输入原密码" maxLength={18} aria-invalid={Boolean(errors.currentPassword)} /></div>{errors.currentPassword && <small role="alert">{errors.currentPassword}</small>}</label>}
        <label><span>新密码</span><div className={errors.password ? 'invalid' : ''}><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => changePassword(event.target.value)} placeholder="8-18位，包含字母和数字" maxLength={18} aria-invalid={Boolean(errors.password)} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? '隐藏密码' : '显示密码'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>{errors.password && <small role="alert">{errors.password}</small>}</label>
        <label><span>确认新密码</span><div className={errors.confirmation ? 'invalid' : ''}><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(event) => changeConfirmation(event.target.value)} placeholder="请再次输入新密码" maxLength={18} aria-invalid={Boolean(errors.confirmation)} /></div>{errors.confirmation && <small role="alert">{errors.confirmation}</small>}</label>
        <label><span>验证码</span><div className={`profile-settings-v2-code-field ${errors.code ? 'invalid' : ''}`}><input value={code} onChange={(event) => changeCode(event.target.value)} placeholder="请输入验证码" inputMode="numeric" maxLength={4} aria-invalid={Boolean(errors.code)} /><button type="button" onClick={resend} disabled={countdown > 0}>{countdown > 0 ? `${countdown}s后重新获取` : '获取验证码'}</button></div>{errors.code && <small role="alert">{errors.code}</small>}</label>
      </section>
      <section className="profile-settings-v2-requirements" aria-label="密码要求"><p className={checks.length ? 'done' : ''}><Check size={14} />8-18位字符</p><p className={checks.composition ? 'done' : ''}><Check size={14} />同时包含字母和数字</p><p className={checks.matches ? 'done' : ''}><Check size={14} />两次输入一致</p></section>
      <Button className="profile-settings-v2-primary-layout" type="submit" size="lg" fullWidth disabled={!password && !confirmation && !code}>保存</Button>
    </form>}
    <div className="profile-settings-v2-dialog-node" data-node-id="4053:8858"><Dialog open={scenario === 'confirm'} onClose={() => setScenario('fill')} title={`确认${actionName}密码?`} showClose={false} className="profile-settings-v2-dialog" actions={<><Button variant="outline" onClick={() => setScenario('fill')}>再看看</Button><Button onClick={() => setScenario('submitting')}>确认{actionName}</Button></>}><p>确认{actionName}当前账号 {maskedPhone} 的登录密码？</p></Dialog></div>
    <div className="profile-settings-v2-dialog-node" data-node-id="4053:8894"><Dialog open={scenario === 'submitting'} onClose={() => undefined} title={`正在${actionName}密码`} showClose={false} closeOnBackdrop={false} className="profile-settings-v2-dialog profile-settings-v2-busy-dialog"><span className="spinner" /><p>请稍候…</p></Dialog></div>
    <div className="profile-settings-v2-dialog-node" data-node-id="4053:8964"><Dialog open={scenario === 'failure'} onClose={() => setScenario('fill')} title={`${actionName}失败`} showClose={false} className="profile-settings-v2-dialog" actions={<><Button variant="outline" onClick={() => setScenario('fill')}>返回{actionName}</Button><Button onClick={() => setScenario('submitting')}>重新提交</Button></>}><span className="profile-settings-v2-dialog-error"><XCircle size={18} /></span><p>密码{actionName}失败，请稍后重试。当前密码未发生变更，<br />你仍可正常登录。</p></Dialog></div>
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
      <section className="profile-settings-v2-binding-list" aria-label="可绑定的三方账号">{providerMeta.map((provider) => <Cell className="profile-settings-v2-binding-cell" key={provider.id} icon={provider.icon} label={provider.label} description={provider.detail} arrow={false} trailing={<Button variant={bindings[provider.id] ? 'outline' : 'primary'} size="sm" onClick={() => bindings[provider.id] ? setConfirming(provider.id) : update(provider.id, true)}>{bindings[provider.id] ? '已绑定' : '去绑定'}</Button>} />)}</section>
      <p className="profile-settings-v2-footnote">此页为交互原型，绑定与解绑不会调用微信、QQ 或 Apple 服务。</p>
    </div>
    <Dialog open={Boolean(target && confirming)} onClose={() => setConfirming(null)} title={`解绑${target?.label ?? ''}？`} showClose={false} className="profile-settings-v2-dialog" actions={<><Button variant="outline" onClick={() => setConfirming(null)}>取消</Button><Button onClick={() => confirming && update(confirming, false)}>确认解绑</Button></>}><span className="profile-settings-v2-dialog-icon"><Unlink size={22} aria-hidden="true" /></span><p>解绑后将无法使用{target?.label}快捷登录，但不影响手机号登录。</p></Dialog>
    <Toast message={toast} onDismiss={() => setToast('')} />
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
      <section className="profile-settings-v2-cancel-hero"><span><AlertTriangle size={25} aria-hidden="true" /></span><Heading as="h2" variant="section">请谨慎操作</Heading><p>注销账号是不可逆操作，正式功能上线后会先校验账号与交易状态。</p></section>
      <section className="profile-settings-v2-risk"><Heading as="h2" variant="section">注销后你将失去</Heading><ul><li>个人账号与实名信息</li><li>历史订单、售后与回收记录</li><li>收藏、消息和个性化设置</li></ul></section>
      <Checkbox className="profile-settings-v2-check-layout" checked={agreed} onCheckedChange={(checked) => { setAgreed(checked); setError('') }} label="我已了解上述风险，并确认继续" />
      {error && <p className="profile-settings-v2-error" role="alert">{error}</p>}
      <Button className="profile-settings-v2-danger-layout" variant="danger" size="lg" fullWidth onClick={() => agreed ? setConfirming(true) : setError('请先阅读并确认注销风险')}>申请注销</Button>
      <p className="profile-settings-v2-demo-note">原型演示不会删除任何账号或交易数据，确认后仅退出当前登录。</p>
    </div>
    <Dialog open={confirming} onClose={() => setConfirming(false)} title="确认演示注销？" showClose={false} className="profile-settings-v2-dialog" actions={<><Button variant="outline" onClick={() => setConfirming(false)}>取消</Button><Button variant="danger" onClick={exitDemoAccount}>确认退出</Button></>}><span className="profile-settings-v2-dialog-icon danger"><AlertTriangle size={22} aria-hidden="true" /></span><p>当前为本地原型，本次操作仅会退出登录，不会删除任何真实数据。</p></Dialog>
  </main>
}

export function PrivacyAgreementCenterPage() {
  return <main className="profile-settings-v2-page">
    <ProfileSettingsTopBar title="隐私与协议" />
    <div className="profile-settings-v2-scroll">
      <section aria-label="隐私与协议列表"><ProfileFeatureList>
        <Cell label="隐私协议" to="/privacy-policy" />
        <Cell label="用户协议" to="/user-agreement" />
        <Cell label="关于我们" to="/about-us" />
      </ProfileFeatureList>
      </section>
    </div>
  </main>
}

export function AboutUsPage() {
  return <main className="profile-settings-v2-page">
    <ProfileSettingsTopBar title="关于我们" />
    <div className="profile-settings-v2-scroll profile-settings-v2-about">
      <section className="profile-settings-v2-brand-card" aria-label="平台介绍"><span><img src={assetPath('assets/auth-draft3/brand-mark.svg')} alt="深度玩家 Logo" width={38} height={40} /></span><Heading as="h2" variant="section">深度玩家</Heading><p>专注游戏账号估价、交易保障与售后服务，帮助玩家更安心地完成数字资产交易。</p></section>
      <section className="profile-settings-v2-list profile-settings-v2-company" aria-label="平台信息"><dl>
        <div><dt>当前版本</dt><dd>v1.0.0</dd></div>
        <div><dt>运营主体</dt><dd>子瓜手虫（上海）电子商务有限公司</dd></div>
        <div><dt>备案号</dt><dd>沪ICP备2024065370号-3A</dd></div>
      </dl></section>
    </div>
  </main>
}
