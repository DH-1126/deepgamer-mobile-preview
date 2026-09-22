import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bell, Check, Eye, EyeOff, RotateCw, Shield, UserRound, X } from 'lucide-react'
import { agreementSections, AUTH_POLICY_UPDATED_AT, DEMO_MASKED_PHONE, DEMO_PASSWORD, privacySections } from '../data/authFixtures'
import { buildLoginRoute, formatLoginPhone, getCountdown, getLoginFigmaNodeId, getRecoveryFigmaNodeId, getWelcomeFigmaNodeId, isValidMainlandPhone, normalizeCode, normalizePhone, sanitizeReturnTo, type WelcomePhase } from '../components/authModel'
import { AuthVerificationDialog, type AuthVerificationIntent } from '../components/AuthVerificationDialog'
import { DesignPromptTrigger } from '../components/DesignPromptTrigger'
import { isGuestAccessiblePath } from '../components/authAccessModel'
import { assetPath } from '../components/assetPath'
import { Button, Checkbox, Dialog, Heading, IconButton, Spinner, TextField, Toast } from '../components/ui'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import { authRepository } from '../repository/authRepository'
import type { AuthMethod, PolicySection } from '../types/auth'
import '../styles/auth-v2.css'
import '../styles/auth-recovery.css'

const LOGIN_METHOD_LABELS: Record<AuthMethod, string> = {
  one_tap: '一键登录',
  code: '验证码登录',
  password: '密码登录',
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`auth-v2-brand ${compact ? 'compact' : ''}`}>
    <span className="auth-v2-brand-mark"><img src={assetPath('assets/auth-draft3/brand-mark.svg')} alt="" /></span>
    <Heading as="h1" variant="page">{compact ? '登录深度玩家' : '深度玩家'}</Heading>
    {!compact && <small>一亿玩家自己的游戏平台</small>}
  </div>
}

function AgreementLinks() {
  return <span>已阅读并同意 <Link to="/user-agreement">《用户服务协议》</Link> 和 <Link to="/privacy-policy">《隐私政策》</Link></span>
}

function AgreementCheck({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <Checkbox className="auth-v2-agreement" checked={checked} onCheckedChange={onChange} label={<span className="auth-v2-agreement-copy"><AgreementLinks /></span>} />
}

function InitialAgreementDialog({ confirmExit, exitNotice, onAgree, onReject, onContinue }: { confirmExit: boolean; exitNotice: boolean; onAgree: () => void; onReject: () => void; onContinue: () => void }) {
  return <Dialog open onClose={onReject} showClose={false} closeOnBackdrop={false} title={confirmExit ? '暂不同意隐私协议？' : '请先阅读并同意协议'} className="initial-agreement-dialog" actions={confirmExit ? <><Button onClick={onContinue}>返回查看协议</Button><Button variant="outline" onClick={onReject}>退出深度玩家</Button></> : <><Button variant="outline" onClick={onReject}>不同意</Button><Button onClick={onAgree}>同意并继续</Button></>}>
    {confirmExit ? <div className="auth-v2-dialog-copy"><p>不同意后无法继续使用深度玩家，包括浏览商品、下单和查看订单。</p><p>你随时可以返回重新阅读协议。</p>{exitNotice && <p className="auth-v2-prototype-note" role="status">原型说明：真实应用将在此退出；网页原型不会跳过协议进入游客首页。</p>}</div> : <p>开始使用前，请阅读并同意 <Link to="/user-agreement">《用户服务协议》</Link> 和 <Link to="/privacy-policy">《隐私政策》</Link>。</p>}
  </Dialog>
}

export function WelcomePage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<WelcomePhase>('splash')
  const [exitNotice, setExitNotice] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  useEffect(() => {
    if (phase !== 'splash' || reviewOpen) return undefined
    // Every launch must ask for consent; loading starts only after the user agrees.
    const timer = window.setTimeout(() => setPhase('agreement'), 2_000)
    return () => window.clearTimeout(timer)
  }, [phase, reviewOpen])
  useEffect(() => {
    if (phase !== 'loading' || reviewOpen) return undefined
    // Completing startup unlocks guest browsing, not an authenticated session.
    // Always land on home, even when a refresh started on a protected route.
    const timer = window.setTimeout(() => { authRepository.completeLaunch(); navigate('/', { replace: true }) }, 2_000)
    return () => window.clearTimeout(timer)
  }, [navigate, phase, reviewOpen])
  const agree = () => {
    if (!authRepository.acceptInitialAgreement()) { setPhase('error'); return }
    setPhase('loading')
  }
  const explainPrototypeExit = () => setExitNotice(true)
  const figmaNodeId = getWelcomeFigmaNodeId(phase)
  return <main className={`auth-v2-page auth-v2-welcome ${phase === 'loading' ? 'is-loading' : ''}`} aria-busy={phase === 'loading'} data-node-id={figmaNodeId} data-design-reference={phase === 'agreement' || phase === 'exit' ? 'exact' : 'local-prototype'}>
    <DesignPromptTrigger nodeId={figmaNodeId} tone={phase === 'agreement' || phase === 'exit' ? 'inverse' : 'default'} className="auth-v2-status" onReviewOpenChange={setReviewOpen} />
    <Brand />
    {phase === 'loading' && <span className="auth-v2-loading-status"><Spinner label="正在加载安全交易环境" size="sm" />正在加载安全交易环境</span>}
    <p className="auth-v2-welcome-foot">深度玩家 · 玩家自己的交易平台</p>
    {phase === 'error' && <div className="auth-v2-load-error" role="alert"><span>协议状态保存失败</span><button type="button" onClick={() => setPhase('agreement')}><RotateCw size={15} />重试</button></div>}
    {(phase === 'agreement' || phase === 'exit') && <InitialAgreementDialog confirmExit={phase === 'exit'} exitNotice={exitNotice} onAgree={agree} onReject={() => phase === 'exit' ? explainPrototypeExit() : setPhase('exit')} onContinue={() => { setExitNotice(false); setPhase('agreement') }} />}
  </main>
}

type LoginDraft = { phone: string; code: string; password: string; agreed: boolean; codeSent: boolean; cooldownUntil: number }
const loginDrafts: Partial<Record<AuthMethod, LoginDraft>> = {}

export function LoginPage({ method }: { method: AuthMethod }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const draft = loginDrafts[method]
  const passwordReset = Boolean((location.state as { passwordReset?: boolean } | null)?.passwordReset)
  const [phone, setPhone] = useState(() => (location.state as { loginPhone?: string } | null)?.loginPhone ?? draft?.phone ?? '18788660033')
  const [code, setCode] = useState(() => draft?.code ?? '')
  const [codeSent, setCodeSent] = useState(() => draft?.codeSent ?? false)
  const [password, setPassword] = useState(() => passwordReset ? '' : draft?.password ?? (method === 'password' ? DEMO_PASSWORD : ''))
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(() => draft?.agreed ?? true)
  const [protocolPrompt, setProtocolPrompt] = useState(false)
  const [agreementAction, setAgreementAction] = useState<'login' | 'reset'>('login')
  const [verification, setVerification] = useState<AuthVerificationIntent | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [notice, setNotice] = useState(() => passwordReset ? '密码重置成功，请使用新密码登录' : '')
  const [cooldownUntil, setCooldownUntil] = useState(() => draft?.cooldownUntil ?? 0)
  const [now, setNow] = useState(Date.now())
  const pending = useRef(false)
  const mounted = useRef(true)
  const countdown = getCountdown(cooldownUntil, now)
  const returnTo = useMemo(() => sanitizeReturnTo(params.get('returnTo') ?? (location.state as { returnTo?: string } | null)?.returnTo), [location.state, params])
  const closeTo = useMemo(() => sanitizeReturnTo(params.get('closeTo'), isGuestAccessiblePath(returnTo) ? returnTo : '/'), [params, returnTo])
  const saveDraft = (next: Partial<LoginDraft> = {}) => { loginDrafts[method] = { phone, code, password, agreed, codeSent, cooldownUntil, ...next } }

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => {
    if (!countdown) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [countdown])
  const finishLoginFeedback = useCallback(() => navigate(returnTo, { replace: true }), [navigate, returnTo])

  const goToMethod = (next: AuthMethod) => { saveDraft(); navigate(buildLoginRoute(next, returnTo, closeTo), { state: { loginPhone: phone } }) }
  const requireAgreement = (action: 'login' | 'reset' = 'login') => { if (agreed) return true; setAgreementAction(action); setProtocolPrompt(true); return false }
  const finish = async (request: () => ReturnType<typeof authRepository.loginOneTap>) => {
    if (pending.current || success) return
    pending.current = true
    setBusy(true); setError('')
    try {
      const result = await request()
      if (!mounted.current) return
      if (!result.ok) {
        if (result.reason === 'unregistered') setVerification({ mode: 'register', phone, password })
        else if (result.reason === 'password_reset_required') navigate('/forgot-password', { state: { loginPhone: phone, returnTo, closeTo, trigger: 'attempts' } })
        else setError(result.error)
        return
      }
      setPassword('')
      delete loginDrafts[method]
      setSuccess('登录成功，正在返回…')
    } catch {
      if (mounted.current) setError('登录失败，请稍后重试')
    } finally {
      pending.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const openRecovery = () => {
    if (!isValidMainlandPhone(phone)) { setError('请先输入正确的手机号'); return }
    setError('')
    if (!requireAgreement('reset')) return
    saveDraft()
    navigate('/forgot-password', { state: { loginPhone: phone, returnTo, closeTo, trigger: 'manual' } })
  }
  const requestCode = async () => {
    setError('')
    const result = await authRepository.requestCode(phone)
    if (!result.ok) { setError(result.error); return }
    setCooldownUntil(result.cooldownUntil); setNow(Date.now()); setCodeSent(true); saveDraft({ codeSent: true, cooldownUntil: result.cooldownUntil })
  }
  const proceed = () => {
    if (method === 'one_tap') void finish(() => authRepository.loginOneTap(true))
    else if (method === 'code') void finish(() => authRepository.loginWithCode(phone, code, true))
    else if (method === 'password') void finish(() => authRepository.loginWithPassword(phone, password, true))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!requireAgreement()) return
    proceed()
  }

  const manual = method !== 'one_tap'
  const displayedPhone = formatLoginPhone(phone)
  const figmaNodeId = verification?.mode === 'register' ? 'auth:register-verification' : getLoginFigmaNodeId(method, { agreed, protocolPrompt, codeSent })

  return <main className={`auth-v2-page auth-v2-login auth-v2-login-${method}${manual ? ' auth-v2-login-manual' : ''}`} data-node-id={figmaNodeId}>
    <DesignPromptTrigger nodeId={figmaNodeId} className="auth-v2-status" />
    <nav className="auth-v2-login-nav" aria-label="登录页导航">
      <IconButton label="关闭登录，返回之前页面" onClick={() => navigate(closeTo, { replace: true })}><X size={21} /></IconButton>
    </nav>
    <form className="auth-v2-login-body" onSubmit={submit} noValidate>
      <Brand compact />
      <div className="auth-v2-login-controls">
        {method === 'one_tap' ? <>
          <div className="auth-v2-login-fields one-tap"><div className="auth-v2-one-tap-phone">{DEMO_MASKED_PHONE}</div><small className="auth-v2-one-tap-carrier">中国移动提供认证服务</small></div>
          <Button className="auth-v2-login-action" type="submit" size="xl" fullWidth loading={busy}>{LOGIN_METHOD_LABELS[method]}</Button>
        </> : <>
          <div className="auth-v2-login-fields">
            <TextField className="auth-v2-login-field auth-v2-phone-field" inputMode="tel" autoComplete="tel" aria-label="手机号" value={displayedPhone} onChange={(event) => { const value = normalizePhone(event.target.value); setPhone(value); saveDraft({ phone: value }) }} placeholder="请输入手机号" leading={<span className="auth-v2-phone-prefix"><b>+86</b><i /></span>} trailing={phone ? <button type="button" className="auth-v2-phone-clear" aria-label="清空手机号" onClick={() => { setPhone(''); saveDraft({ phone: '' }) }}><X size={11} /></button> : undefined} />
            {method === 'code' && <><TextField className="auth-v2-login-field auth-v2-code-field" inputMode="numeric" autoComplete="one-time-code" aria-label="验证码" value={code} onChange={(event) => { const value = normalizeCode(event.target.value); setCode(value); saveDraft({ code: value }) }} placeholder="请输入 6 位验证码" trailing={<button type="button" className="auth-v2-code-link" disabled={countdown > 0} onClick={requestCode}>{countdown ? `${countdown}s 后重发` : codeSent ? '重新获取' : '获取验证码'}</button>} /><div className="auth-v2-code-help"><Link to="/sms-help" state={{ backTo: location.pathname + location.search, loginPhone: phone }} onClick={() => saveDraft()}>无法接收短信？</Link></div></>}
            {method === 'password' && <><TextField className="auth-v2-login-field auth-v2-password-field" type={showPassword ? 'text' : 'password'} autoComplete="current-password" aria-label="登录密码" value={password} onChange={(event) => { const value = event.target.value; setPassword(value); saveDraft({ password: value }); setError('') }} placeholder="请输入登录密码" trailing={<button type="button" className="auth-v2-password-visibility" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>} /><button type="button" className="auth-v2-forgot" disabled={busy || Boolean(success)} onClick={openRecovery}>忘记密码？</button></>}
          </div>
          <Button className="auth-v2-login-action" type="submit" size="xl" fullWidth loading={busy}>{LOGIN_METHOD_LABELS[method]}</Button>
        </>}
        {error && <div className="auth-v2-feedback" role="alert">{error}</div>}
      </div>
      <div className="auth-v2-method-links">{method === 'one_tap' ? <><button type="button" onClick={() => goToMethod('code')}>{LOGIN_METHOD_LABELS.code}</button><i aria-hidden="true" /><button type="button" onClick={() => goToMethod('password')}>{LOGIN_METHOD_LABELS.password}</button></> : <><button type="button" onClick={() => goToMethod('one_tap')}>{LOGIN_METHOD_LABELS.one_tap}</button><i aria-hidden="true" /><button type="button" onClick={() => goToMethod(method === 'password' ? 'code' : 'password')}>{LOGIN_METHOD_LABELS[method === 'password' ? 'code' : 'password']}</button></>}</div>
      <AgreementCheck checked={agreed} onChange={() => setAgreed((value) => { saveDraft({ agreed: !value }); return !value })} />
    </form>
    {verification && <AuthVerificationDialog intent={verification} onClose={() => setVerification(null)} onSuccess={() => { delete loginDrafts[method]; setVerification(null); setPassword(''); setError(''); setSuccess(verification.mode === 'register' ? '注册成功，正在登录…' : '密码重置成功，正在登录…') }} />}
    <Toast message={success} onDismiss={finishLoginFeedback} />
    <Toast message={notice} onDismiss={() => setNotice('')} />
    <div className="auth-v2-protocol-dialog-node" data-node-id="7081:385"><Dialog open={protocolPrompt} onClose={() => setProtocolPrompt(false)} title="请先阅读并同意协议" showClose={false} className="auth-v2-protocol-dialog" actions={<><Button variant="outline" onClick={() => setProtocolPrompt(false)}>不同意</Button><Button onClick={() => { setAgreed(true); saveDraft({ agreed: true }); setProtocolPrompt(false); if (agreementAction === 'reset') navigate('/forgot-password', { state: { loginPhone: phone, returnTo, closeTo, trigger: 'manual' } }); else proceed() }}>同意并登录</Button></>}><p data-node-id="7081:415">继续登录前，需要你阅读并同意 <Link to="/user-agreement">《用户服务协议》</Link> 和 <Link to="/privacy-policy">《隐私政策》</Link>。未注册的手机号将在登录成功后自动创建账号。</p></Dialog></div>
  </main>
}

type RecoveryErrors = { password?: string; confirmation?: string; code?: string }
type RecoveryDraft = { phone: string; password: string; confirmation: string; code: string }

// Route transitions (for example, opening SMS help) unmount this page. Keep the
// unfinished credential draft in document memory only; never put it in history
// state, URL parameters, Storage, logs, or a network request.
let passwordRecoveryDraft: RecoveryDraft | undefined

export function validateRecoveryForm(password: string, confirmation: string, code: string): RecoveryErrors {
  const errors: RecoveryErrors = {}
  const validLength = password.length >= 8 && password.length <= 18
  const validComposition = /[A-Za-z]/.test(password) && /\d/.test(password)
  if (!validLength || !validComposition) errors.password = '密码需为 8-18 位，并同时包含字母和数字'
  if (!confirmation || password !== confirmation) errors.confirmation = '两次输入的密码不一致'
  if (!/^\d{6}$/.test(code)) errors.code = code ? '请输入 6 位验证码' : '请输入验证码'
  return errors
}

function RecoveryHeader({ title, onBack, support = false, nodeId }: { title: string; onBack: () => void; support?: boolean; nodeId: string }) {
  return <>
    <DesignPromptTrigger nodeId={nodeId} className="auth-recovery__status" />
    <header className="auth-recovery__header">
      <IconButton label="返回" onClick={onBack}><ArrowLeft size={20} /></IconButton>
      {title ? <Heading as="h1" variant="section" className="auth-recovery__title">{title}</Heading> : <span className="auth-recovery__title" aria-hidden="true" />}
      {support ? <Link to={SUPPORT_CONVERSATION_ROUTE}>客服</Link> : <span aria-hidden="true" />}
    </header>
  </>
}

function PasswordRule({ met, invalid = false, children }: { met: boolean; invalid?: boolean; children: string }) {
  return <li className={invalid ? 'is-invalid' : met ? 'is-met' : ''}>{invalid ? <X size={12} /> : met ? <Check size={12} /> : null}<span>{children}</span></li>
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const recovery = (location.state as { loginPhone?: string; returnTo?: string; closeTo?: string; trigger?: 'attempts' | 'manual' } | null) ?? {}
  const phone = normalizePhone(recovery.loginPhone ?? '')
  const hasPhone = isValidMainlandPhone(phone)
  const returnTo = sanitizeReturnTo(recovery.returnTo)
  const closeTo = sanitizeReturnTo(recovery.closeTo, '/')
  const carriedDraft = passwordRecoveryDraft?.phone === phone ? passwordRecoveryDraft : undefined
  const [password, setPassword] = useState(() => carriedDraft?.password ?? '')
  const [confirmation, setConfirmation] = useState(() => carriedDraft?.confirmation ?? '')
  const [code, setCode] = useState(() => carriedDraft?.code ?? '')
  const [visible, setVisible] = useState({ password: false, confirmation: false })
  const [errors, setErrors] = useState<RecoveryErrors>({})
  const [pageError, setPageError] = useState('')
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [cooldownUntil, setCooldownUntil] = useState(() => hasPhone ? authRepository.getPasswordCodeCooldown(phone, 'reset') : 0)
  const countdown = getCountdown(cooldownUntil, now)
  const mounted = useRef(true)
  const pending = useRef(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmationRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const checks = {
    length: password.length >= 8 && password.length <= 18,
    composition: /[A-Za-z]/.test(password) && /\d/.test(password),
    matches: Boolean(confirmation) && password === confirmation,
  }
  const canSubmit = hasPhone && checks.length && checks.composition && checks.matches && /^\d{6}$/.test(code) && !sending && !submitting

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!countdown) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [countdown])

  const clearDraft = () => { if (passwordRecoveryDraft?.phone === phone) passwordRecoveryDraft = undefined }
  const backToPasswordLogin = () => { clearDraft(); navigate(buildLoginRoute('password', returnTo, closeTo), { replace: !hasPhone, state: { loginPhone: phone || undefined } }) }
  const leaveRecovery = () => { clearDraft(); navigate(-1) }
  const change = (field: keyof RecoveryErrors, value: string) => {
    const next = { phone, password, confirmation, code }
    if (field === 'password') { setPassword(value); next.password = value }
    else if (field === 'confirmation') { setConfirmation(value); next.confirmation = value }
    else { const normalized = normalizeCode(value); setCode(normalized); next.code = normalized }
    passwordRecoveryDraft = next
    setErrors(previous => ({ ...previous, [field]: undefined }))
    setPageError('')
  }
  const sendCode = async () => {
    if (!hasPhone || pending.current || countdown) return
    pending.current = true; setSending(true); setPageError('')
    try {
      const result = await authRepository.requestPasswordCode(phone, 'reset')
      if (!mounted.current) return
      if (!result.ok) { setPageError(result.error); return }
      setCooldownUntil(result.cooldownUntil); setNow(Date.now()); setSent(true)
      codeRef.current?.focus()
    } catch {
      if (mounted.current) setPageError('验证码发送失败，请稍后重试')
    } finally {
      pending.current = false
      if (mounted.current) setSending(false)
    }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!hasPhone || pending.current) return
    const next = validateRecoveryForm(password, confirmation, code)
    setErrors(next); setPageError('')
    if (Object.keys(next).length) {
      ;(next.password ? passwordRef : next.confirmation ? confirmationRef : codeRef).current?.focus()
      return
    }
    pending.current = true; setSubmitting(true)
    try {
      const result = await authRepository.resetPasswordWithCode(phone, password, confirmation, code, true)
      if (!mounted.current) return
      if (!result.ok) {
        if (result.field) setErrors({ [result.field]: result.error })
        else setPageError(result.error)
        return
      }
      clearDraft()
      delete loginDrafts.password
      navigate(buildLoginRoute('password', returnTo, closeTo), { replace: true, state: { loginPhone: phone, passwordReset: true } })
    } catch {
      if (mounted.current) setPageError('保存失败，请稍后重试')
    } finally {
      pending.current = false
      if (mounted.current) setSubmitting(false)
    }
  }
  const passwordField = (field: 'password' | 'confirmation', label: string, placeholder: string) => <TextField
    ref={field === 'password' ? passwordRef : confirmationRef}
    className="auth-recovery__field" label={label} aria-label={label} placeholder={placeholder}
    type={visible[field] ? 'text' : 'password'} autoComplete="new-password" maxLength={18}
    value={field === 'password' ? password : confirmation} disabled={sending || submitting}
    onChange={event => change(field, event.target.value)} error={errors[field]}
    onBlur={() => {
      const next = validateRecoveryForm(password, confirmation, code)
      if (field === 'password' && password && next.password) setErrors(previous => ({ ...previous, password: next.password }))
      if (field === 'confirmation' && confirmation && next.confirmation) setErrors(previous => ({ ...previous, confirmation: next.confirmation }))
    }}
    trailing={<IconButton label={`${visible[field] ? '隐藏' : '显示'}${label}`} aria-pressed={visible[field]} disabled={sending || submitting} onClick={() => setVisible(previous => ({ ...previous, [field]: !previous[field] }))}>{visible[field] ? <EyeOff size={19} /> : <Eye size={19} />}</IconButton>}
  />

  const recoveryNodeId = getRecoveryFigmaNodeId({ password, confirmation, code, sent, errors, pageError })

  if (!hasPhone) return <main className="auth-v2-page auth-recovery" data-node-id="7087:620">
    <RecoveryHeader title="找回登录密码" onBack={backToPasswordLogin} support nodeId="7087:620" />
    <section className="auth-recovery__missing" role="alert">
      <Shield size={36} />
      <Heading as="h2" variant="page">请先确认登录手机号</Heading>
      <p>返回密码登录页填写手机号后，再使用短信验证码找回密码。</p>
      <Button fullWidth onClick={backToPasswordLogin}>返回填写手机号</Button>
    </section>
  </main>

  return <main className="auth-v2-page auth-recovery" data-node-id={recoveryNodeId}>
    <RecoveryHeader title="找回登录密码" onBack={leaveRecovery} support nodeId={recoveryNodeId} />
    <form className="auth-recovery__form" noValidate onSubmit={submit} aria-busy={sending || submitting}>
      <div className="auth-recovery__intro"><Heading as="h2" variant="page">设置新密码</Heading><p>当前账号 <b>{formatLoginPhone(phone)}</b></p></div>
      {recovery.trigger === 'attempts' && <p className="auth-recovery__attempt-note">密码错误次数过多，请验证手机号后重置。</p>}
      <section className="auth-recovery__card auth-recovery__fields">
        {passwordField('password', '新密码', '请输入新密码')}
        {passwordField('confirmation', '确认新密码', '请再次输入新密码')}
        <div className="auth-recovery__code">
          <TextField ref={codeRef} className="auth-recovery__field" label="验证码" aria-label="验证码" placeholder="请输入验证码" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={sending || submitting} onChange={event => change('code', event.target.value)} onBlur={() => { const next = validateRecoveryForm(password, confirmation, code); if (code && next.code) setErrors(previous => ({ ...previous, code: next.code })) }} error={errors.code} />
          <Button className="auth-recovery__send" variant="outline" loading={sending} disabled={submitting || countdown > 0} onClick={sendCode}>{countdown ? '已发送' : sent ? '重新获取' : '获取验证码'}</Button>
        </div>
        <div className="auth-recovery__code-meta"><Link to="/sms-help" state={{ backTo: '/forgot-password', loginPhone: phone, returnTo, closeTo, trigger: recovery.trigger }}>未收到？检查短信拦截</Link><span>{countdown ? `重新发送 ${countdown}s` : sent ? '可以重新发送' : ''}</span></div>
        {sent && <span className="auth-recovery__sent" role="status">已发送至 {phone.slice(0, 3)}****{phone.slice(-4)}</span>}
        {pageError && <p className="auth-recovery__page-error" role="alert">{pageError}</p>}
      </section>
      <section className="auth-recovery__card auth-recovery__rules" aria-label="密码要求">
        <Heading as="h2" variant="section">密码要求</Heading>
        <ul><PasswordRule met={checks.length} invalid={Boolean(errors.password) && !checks.length}>8-18 个字符</PasswordRule><PasswordRule met={checks.composition} invalid={Boolean(errors.password) && !checks.composition}>同时包含字母和数字</PasswordRule><PasswordRule met={checks.matches} invalid={Boolean(errors.confirmation)}>两次输入保持一致</PasswordRule></ul>
      </section>
      <p className="auth-recovery__security"><Shield size={15} />修改成功后，当前账号需重新登录</p>
      <div className="auth-recovery__spacer" />
      <footer className="auth-recovery__action"><Button type="submit" size="xl" fullWidth loading={submitting} disabled={!canSubmit}>保存</Button></footer>
    </form>
  </main>
}

export function SmsHelpPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const previous = (location.state as { backTo?: string; loginPhone?: string; returnTo?: string; closeTo?: string; trigger?: 'attempts' | 'manual' } | null) ?? {}
  const goBack = () => {
    if (window.history.length > 1) { navigate(-1); return }
    if (previous.backTo === '/forgot-password') { navigate('/forgot-password', { replace: true, state: previous }); return }
    navigate(previous.backTo || '/login/code', { replace: true, state: { loginPhone: previous.loginPhone } })
  }
  return <main className="auth-v2-page auth-sms-help" data-node-id="7082:485">
    <RecoveryHeader title="" onBack={goBack} nodeId="7082:485" />
    <article>
      <Heading as="h1" variant="page">无法接收短信的原因</Heading>
      <ol>
        <li>请检查手机号是否填错，输错号码后请重新输入后获取登录短信；</li>
        <li>请检查手机网络信号，服务器发出的短信验证码可能延迟，需耐心等待，或稍后尝试 60s 重新获取；</li>
        <li>短信被手机安全软件误拦截，请检查垃圾短信；</li>
        <li>请检查手机号是否欠费，如欠费运营商会暂停短信接收功能。</li>
      </ol>
    </article>
  </main>
}

function PolicyPage({ type }: { type: 'privacy' | 'agreement' }) {
  const navigate = useNavigate()
  const privacy = type === 'privacy'
  const sections: PolicySection[] = privacy ? privacySections : agreementSections
  const figmaNodeId = privacy ? '7082:531' : '7082:626'
  return <main className="auth-v2-page auth-v2-policy" data-node-id={figmaNodeId}>
    <header><DesignPromptTrigger nodeId={figmaNodeId} /><nav><button type="button" aria-label="返回" onClick={() => navigate(-1)}><ArrowLeft size={21} /></button></nav></header>
    <article>
      <Heading variant="page">{privacy ? '深度玩家隐私政策' : '用户服务协议'}</Heading>
      {privacy ? <div className="auth-v2-policy-meta"><dl><div><dt>应用名称</dt><dd>深度玩家</dd></div><div><dt>开发者名称</dt><dd>待法务确认</dd></div><div><dt>更新日期</dt><dd>{AUTH_POLICY_UPDATED_AT}</dd></div><div><dt>生效日期</dt><dd>{AUTH_POLICY_UPDATED_AT}</dd></div></dl></div>
        : <><p className="auth-v2-policy-date">更新时间 {AUTH_POLICY_UPDATED_AT}<span>生效时间 {AUTH_POLICY_UPDATED_AT}</span></p><section className="auth-v2-policy-important"><Heading variant="section">重点条款提示</Heading><ul><li>免除或限制平台责任的条款</li><li>对用户权利进行限制的条款</li><li>争议解决方式与司法管辖条款</li></ul><p>上述条款在正文中以加粗标示，请在同意前重点阅读。</p></section></>}
      {privacy && <nav className="auth-v2-policy-chips" aria-label="政策章节">{sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav>}
      <div className="auth-v2-policy-copy">{sections.map((section) => <section id={section.id} key={section.id}><Heading as="h2" variant="section">{section.title}</Heading>{section.paragraphs.map((paragraph, index) => <p key={index}>{privacy && section.id === 'notice' ? `${index + 1}. ` : ''}{paragraph}</p>)}</section>)}</div>
      <aside><strong>文案占位说明</strong><p>以上为便于评审的产品级示例文案。正式收集范围、留存期限、第三方共享清单和权利行使方式须由法务与合规团队确认后替换。</p></aside>
    </article>
  </main>
}

export function PrivacyPolicyPage() { return <PolicyPage type="privacy" /> }
export function UserAgreementPage() { return <PolicyPage type="agreement" /> }

export function PushPermissionPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const current = authRepository.getPushPermission()
  const returnTo = sanitizeReturnTo(params.get('returnTo'), '/profile')
  const choose = (value: 'allowed' | 'denied') => {
    setBusy(true); setError('')
    window.setTimeout(() => {
      if (!authRepository.setPushPermission(value)) { setError('设置保存失败，请重试'); setBusy(false); return }
      navigate(returnTo, { replace: true })
    }, 220)
  }
  return <main className="auth-v2-page auth-v2-push" data-node-id="511:9537">
    <DesignPromptTrigger nodeId="auth:push-permission" className="auth-v2-status auth-v2-push-review" />
    <section className="auth-v2-push-profile" aria-hidden="true"><div><span><UserRound size={25} /></span><strong>玩家_8471<small>已实名　ID 20260803</small></strong></div><dl><div><dt>¥0.00</dt><dd>余额</dd></div><div><dt>2</dt><dd>收藏</dd></div></dl><aside><b>待处理 2 件</b><small>待付款 1 · 待确认收货 1</small></aside></section>
    <div className="auth-v2-push-mask" />
    <section className="auth-v2-push-dialog" role="dialog" aria-modal="true" aria-labelledby="push-title">
      <header><i><Bell size={18} /></i><Heading as="h1" variant="page" id="push-title">开启交易提醒？</Heading></header>
      <p>开启后，卖家换绑、客服回复和付款倒计时会及时通知你，避免订单超时。</p>
      <small>你可以稍后在系统设置中修改。{current !== 'prompt' && ` 当前为${current === 'allowed' ? '已开启' : '未开启'}。`}</small>
      {error && <em role="alert">{error}</em>}
      <footer><button type="button" disabled={busy} onClick={() => choose('denied')}>暂不开启</button><button type="button" className="primary" disabled={busy} onClick={() => choose('allowed')}>{busy ? '设置中…' : '开启提醒'}</button></footer>
    </section>
  </main>
}
