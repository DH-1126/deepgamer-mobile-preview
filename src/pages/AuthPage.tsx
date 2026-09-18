import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bell, Check, Eye, EyeOff, RotateCw, UserRound, X } from 'lucide-react'
import { agreementSections, AUTH_POLICY_UPDATED_AT, DEMO_MASKED_PHONE, DEMO_PASSWORD, privacySections } from '../data/authFixtures'
import { buildLoginRoute, formatLoginPhone, getCountdown, getLoginFigmaNodeId, getWelcomeFigmaNodeId, isValidMainlandPhone, normalizeCode, normalizePhone, sanitizeReturnTo, type WelcomePhase } from '../components/authModel'
import { AuthVerificationDialog, type AuthVerificationIntent } from '../components/AuthVerificationDialog'
import { isGuestAccessiblePath } from '../components/authAccessModel'
import { assetPath } from '../components/assetPath'
import { Button, Checkbox, Dialog, Heading, IconButton, Spinner, StatusBar, TextField, Toast } from '../components/ui'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import { authRepository } from '../repository/authRepository'
import type { AuthMethod, PolicySection } from '../types/auth'
import '../styles/auth-v2.css'

const LOGIN_METHOD_LABELS: Record<AuthMethod, string> = {
  one_tap: '一键登录',
  code: '验证码登录',
  password: '密码登录',
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`auth-v2-brand ${compact ? 'compact' : ''}`}>
    <span className="auth-v2-brand-mark"><img src={assetPath('assets/auth-draft3/brand-mark.svg')} alt="" /></span>
    <strong>{compact ? '登录深度玩家' : '深度玩家'}</strong>
    {!compact && <small>一亿玩家自己的游戏平台</small>}
  </div>
}

function AgreementLinks() {
  return <span>已阅读并同意 <Link to="/user-agreement">《用户服务协议》</Link> 和 <Link to="/privacy-policy">《隐私政策》</Link></span>
}

function AgreementCheck({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <Checkbox className="auth-v2-agreement" checked={checked} onCheckedChange={onChange} label={<span className="auth-v2-agreement-copy"><AgreementLinks /></span>} />
}

function InitialAgreementDialog({ confirmExit, onAgree, onReject, onContinue }: { confirmExit: boolean; onAgree: () => void; onReject: () => void; onContinue: () => void }) {
  return <Dialog open onClose={onReject} showClose={false} closeOnBackdrop={false} title={confirmExit ? '暂不同意隐私协议？' : '请先阅读并同意协议'} className="initial-agreement-dialog" actions={confirmExit ? <><Button onClick={onContinue}>返回查看协议</Button><Button variant="outline" onClick={onReject}>退出深度玩家</Button></> : <><Button variant="outline" onClick={onReject}>不同意</Button><Button onClick={onAgree}>同意并登录</Button></>}>
    {confirmExit ? <div className="auth-v2-dialog-copy"><p>不同意后无法继续使用深度玩家，包括浏览商品、下单和查看订单。</p><p>你随时可以返回重新阅读协议。</p></div> : <p>继续登录前，需要你阅读并同意 <Link to="/user-agreement">《用户服务协议》</Link> 和 <Link to="/privacy-policy">《隐私政策》</Link>。未注册的手机号将在登录成功后自动创建账号。</p>}
  </Dialog>
}

export function WelcomePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [phase, setPhase] = useState<WelcomePhase>('splash')
  const requestedPath = sanitizeReturnTo(params.get('returnTo'))
  const requestedMethod = params.get('loginMethod')
  const loginMethod: AuthMethod = requestedMethod === 'code' || requestedMethod === 'password' ? requestedMethod : 'one_tap'
  const requestedCloseTo = params.get('closeTo')
  const closeTo = requestedCloseTo ? sanitizeReturnTo(requestedCloseTo) : isGuestAccessiblePath(requestedPath) ? requestedPath : '/'
  const destination = buildLoginRoute(loginMethod, requestedPath, closeTo)

  useEffect(() => {
    if (phase !== 'splash') return undefined
    // Every launch must ask for consent; loading starts only after the user agrees.
    const timer = window.setTimeout(() => setPhase('agreement'), 2_000)
    return () => window.clearTimeout(timer)
  }, [phase])
  useEffect(() => {
    if (phase !== 'loading') return undefined
    const timer = window.setTimeout(() => { authRepository.completeLaunch(); navigate(destination, { replace: true }) }, 2_000)
    return () => window.clearTimeout(timer)
  }, [destination, navigate, phase])
  const agree = () => {
    if (!authRepository.acceptInitialAgreement()) { setPhase('error'); return }
    setPhase('loading')
  }
  const leaveAsGuest = () => {
    authRepository.completeLaunch()
    navigate(closeTo, { replace: true })
  }
  return <main className={`auth-v2-page auth-v2-welcome ${phase === 'loading' ? 'is-loading' : ''}`} aria-busy={phase === 'loading'} data-node-id={getWelcomeFigmaNodeId(phase)}>
    <StatusBar tone={phase === 'agreement' || phase === 'exit' ? 'inverse' : 'default'} className="auth-v2-status" />
    <Brand />
    {phase === 'loading' && <span className="auth-v2-loading-status"><Spinner label="正在加载安全交易环境" size="sm" />正在加载安全交易环境</span>}
    <p className="auth-v2-welcome-foot">深度玩家 · 玩家自己的交易平台</p>
    {phase === 'error' && <div className="auth-v2-load-error" role="alert"><span>协议状态保存失败</span><button type="button" onClick={() => setPhase('agreement')}><RotateCw size={15} />重试</button></div>}
    {(phase === 'agreement' || phase === 'exit') && <InitialAgreementDialog confirmExit={phase === 'exit'} onAgree={agree} onReject={() => phase === 'exit' ? leaveAsGuest() : setPhase('exit')} onContinue={() => setPhase('agreement')} />}
  </main>
}

export function LoginPage({ method }: { method: AuthMethod }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [phone, setPhone] = useState(() => (location.state as { loginPhone?: string } | null)?.loginPhone ?? '18788660033')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [password, setPassword] = useState(() => method === 'password' ? DEMO_PASSWORD : '')
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(method !== 'one_tap')
  const [protocolPrompt, setProtocolPrompt] = useState(false)
  const [agreementAction, setAgreementAction] = useState<'login' | 'reset'>('login')
  const [verification, setVerification] = useState<AuthVerificationIntent | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const pending = useRef(false)
  const mounted = useRef(true)
  const countdown = getCountdown(cooldownUntil, now)
  const returnTo = useMemo(() => sanitizeReturnTo(params.get('returnTo') ?? (location.state as { returnTo?: string } | null)?.returnTo), [location.state, params])
  const closeTo = useMemo(() => sanitizeReturnTo(params.get('closeTo'), isGuestAccessiblePath(returnTo) ? returnTo : '/'), [params, returnTo])

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => {
    if (!countdown) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [countdown])
  const finishLoginFeedback = useCallback(() => navigate(returnTo, { replace: true }), [navigate, returnTo])

  const goToMethod = (next: AuthMethod) => navigate(buildLoginRoute(next, returnTo, closeTo), { state: { loginPhone: phone } })
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
        else if (result.reason === 'password_reset_required') setVerification({ mode: 'reset', phone, trigger: 'attempts' })
        else setError(result.error)
        return
      }
      setPassword('')
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
    setVerification({ mode: 'reset', phone, trigger: 'manual' })
  }
  const requestCode = async () => {
    setError('')
    const result = await authRepository.requestCode(phone)
    if (!result.ok) { setError(result.error); return }
    setCooldownUntil(result.cooldownUntil); setNow(Date.now()); setCodeSent(true)
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

  return <main className={`auth-v2-page auth-v2-login auth-v2-login-${method}${manual ? ' auth-v2-login-manual' : ''}`} data-node-id={getLoginFigmaNodeId(method)}>
    <StatusBar className="auth-v2-status" />
    <nav className="auth-v2-login-nav" aria-label="登录页导航">
      <IconButton label="关闭登录，返回之前页面" onClick={() => navigate(closeTo, { replace: true })}><X size={21} /></IconButton>
    </nav>
    <form className="auth-v2-login-body" onSubmit={submit} noValidate>
      <Brand compact />
      <div className="auth-v2-login-controls">
        {method === 'one_tap' ? <>
          <div className="auth-v2-login-fields one-tap"><div className="auth-v2-one-tap-phone">{DEMO_MASKED_PHONE}</div></div>
          <Button className="auth-v2-login-action" type="submit" size="xl" fullWidth loading={busy}>{LOGIN_METHOD_LABELS[method]}</Button>
        </> : <>
          <div className="auth-v2-login-fields">
            <TextField className="auth-v2-login-field auth-v2-phone-field" inputMode="tel" autoComplete="tel" aria-label="手机号" value={displayedPhone} onChange={(event) => setPhone(normalizePhone(event.target.value))} placeholder="请输入手机号" leading={<span className="auth-v2-phone-prefix"><b>+86</b><i /></span>} trailing={phone ? <button type="button" className="auth-v2-phone-clear" aria-label="清空手机号" onClick={() => setPhone('')}><X size={11} /></button> : undefined} />
            {method === 'code' && <><TextField className="auth-v2-login-field auth-v2-code-field" inputMode="numeric" autoComplete="one-time-code" aria-label="验证码" value={code} onChange={(event) => setCode(normalizeCode(event.target.value))} placeholder="请输入验证码" trailing={<button type="button" className="auth-v2-code-link" disabled={countdown > 0} onClick={requestCode}>{countdown ? `${countdown}s后重试` : codeSent ? '重新获取' : '获取验证码'}</button>} /><div className="auth-v2-code-help"><span>收不到验证码？</span><Link to={SUPPORT_CONVERSATION_ROUTE}>联系客服</Link></div></>}
            {method === 'password' && <><TextField className="auth-v2-login-field auth-v2-password-field" type={showPassword ? 'text' : 'password'} autoComplete="current-password" aria-label="登录密码" value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} placeholder="请输入登录密码" trailing={<button type="button" className="auth-v2-password-visibility" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>} /><button type="button" className="auth-v2-forgot" disabled={busy || Boolean(success)} onClick={openRecovery}>忘记密码？</button></>}
          </div>
          <Button className="auth-v2-login-action" type="submit" size="xl" fullWidth loading={busy}>{LOGIN_METHOD_LABELS[method]}</Button>
        </>}
        {error && <div className="auth-v2-feedback" role="alert">{error}</div>}
      </div>
      <div className="auth-v2-method-links">{method === 'one_tap' ? <><button type="button" onClick={() => goToMethod('code')}>{LOGIN_METHOD_LABELS.code}</button><i aria-hidden="true" /><button type="button" onClick={() => goToMethod('password')}>{LOGIN_METHOD_LABELS.password}</button></> : <><button type="button" onClick={() => goToMethod('one_tap')}>{LOGIN_METHOD_LABELS.one_tap}</button><i aria-hidden="true" /><button type="button" onClick={() => goToMethod(method === 'password' ? 'code' : 'password')}>{LOGIN_METHOD_LABELS[method === 'password' ? 'code' : 'password']}</button></>}</div>
      <AgreementCheck checked={agreed} onChange={() => setAgreed((value) => !value)} />
    </form>
    {verification && <AuthVerificationDialog intent={verification} onClose={() => setVerification(null)} onSuccess={() => { setVerification(null); setPassword(''); setError(''); setSuccess(verification.mode === 'register' ? '注册成功，正在登录…' : '密码重置成功，正在登录…') }} />}
    <Toast message={success} onDismiss={finishLoginFeedback} />
    <div className="auth-v2-protocol-dialog-node" data-node-id="3681:25048"><Dialog open={protocolPrompt} onClose={() => setProtocolPrompt(false)} title="请先阅读并同意协议" showClose={false} className="auth-v2-protocol-dialog" actions={<><Button variant="outline" onClick={() => setProtocolPrompt(false)}>不同意</Button><Button onClick={() => { setAgreed(true); setProtocolPrompt(false); if (agreementAction === 'reset') setVerification({ mode: 'reset', phone, trigger: 'manual' }); else proceed() }}>同意并登录</Button></>}><p data-node-id="3681:25084">继续登录前，需要你阅读并同意 <Link to="/user-agreement">《用户服务协议》</Link> 和 <Link to="/privacy-policy">《隐私政策》</Link>。未注册的手机号将在登录成功后自动创建账号。</p></Dialog></div>
  </main>
}

function PolicyPage({ type }: { type: 'privacy' | 'agreement' }) {
  const navigate = useNavigate()
  const privacy = type === 'privacy'
  const sections: PolicySection[] = privacy ? privacySections : agreementSections
  return <main className="auth-v2-page auth-v2-policy" data-node-id={privacy ? '511:10647' : '511:10727'}>
    <header><StatusBar /><nav><button type="button" aria-label="返回" onClick={() => navigate(-1)}><ArrowLeft size={21} /></button></nav></header>
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
    <section className="auth-v2-push-profile" aria-hidden="true"><StatusBar /><div><span><UserRound size={25} /></span><strong>玩家_8471<small>已实名　ID 20260803</small></strong></div><dl><div><dt>¥0.00</dt><dd>余额</dd></div><div><dt>2</dt><dd>收藏</dd></div></dl><aside><b>待处理 2 件</b><small>待付款 1 · 待确认收货 1</small></aside></section>
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
