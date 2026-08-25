import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bell, Check, Eye, EyeOff, RotateCw, UserRound, X } from 'lucide-react'
import { agreementSections, AUTH_POLICY_UPDATED_AT, DEMO_MASKED_PHONE, privacySections } from '../data/authFixtures'
import { buildLoginRoute, getCountdown, maskPhone, normalizeCode, normalizePhone, sanitizeReturnTo } from '../components/authModel'
import { isGuestAccessiblePath } from '../components/authAccessModel'
import { assetPath } from '../components/assetPath'
import { authRepository } from '../repository/authRepository'
import type { AuthMethod, PolicySection } from '../types/auth'
import '../styles/auth-v2.css'

function StatusBar({ inverse = false }: { inverse?: boolean }) {
  return <div className={`auth-v2-status ${inverse ? 'inverse' : ''}`} aria-hidden="true">
    <time>9:41</time>
    <span>
      <img src={assetPath('assets/home-v2/status-signal.svg')} alt="" />
      <img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" />
      <img src={assetPath('assets/home-v2/status-battery.svg')} alt="" />
    </span>
  </div>
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`auth-v2-brand ${compact ? 'compact' : ''}`}>
    <b>DG</b><strong>深度玩家</strong>{!compact && <small>一亿玩家自己的游戏平台</small>}
  </div>
}

function AgreementLinks({ includePrivacy = true }: { includePrivacy?: boolean }) {
  return <span>已阅读并同意 <Link to="/user-agreement">《用户服务协议》</Link>{includePrivacy && <> 和 <Link to="/privacy-policy">《隐私政策》</Link></>}</span>
}

function AgreementCheck({ checked, onChange, includePrivacy = true }: { checked: boolean; onChange: () => void; includePrivacy?: boolean }) {
  return <div className="auth-v2-agreement">
    <button type="button" role="checkbox" aria-checked={checked} aria-label={checked ? '取消同意协议' : '同意协议'} onClick={onChange}>
      {checked && <Check size={12} strokeWidth={3} aria-hidden="true" />}
    </button>
    <AgreementLinks includePrivacy={includePrivacy} />
    {includePrivacy && <small>。用未注册的手机号将自动创建账号。</small>}
  </div>
}

function InitialAgreementDialog({ confirmExit, onAgree, onReject, onContinue }: { confirmExit: boolean; onAgree: () => void; onReject: () => void; onContinue: () => void }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>('button')?.focus())
  }, [confirmExit])
  return <div className="auth-v2-modal-layer">
    <section ref={ref} className="auth-v2-dialog" role="dialog" aria-modal="true" aria-labelledby="initial-agreement-title">
      <h2 id="initial-agreement-title">{confirmExit ? '不同意将无法继续使用' : '请先阅读并同意协议'}</h2>
      {confirmExit
        ? <p>登录和交易服务需要基于协议提供。你可以返回继续阅读，也可以退出深度玩家。</p>
        : <p>继续登录前，需要你阅读并同意 <Link to="/user-agreement">《用户服务协议》</Link> 和 <Link to="/privacy-policy">《隐私政策》</Link>。未注册的手机号将在登录成功后自动创建账号。</p>}
      <footer>
        {confirmExit
          ? <><button type="button" onClick={onContinue}>返回查看协议</button><button type="button" className="secondary" onClick={onReject}>退出深度玩家</button></>
          : <><button type="button" className="secondary" onClick={onReject}>不同意</button><button type="button" className="primary" onClick={onAgree}>同意并登录</button></>}
      </footer>
    </section>
  </div>
}

export function WelcomePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [phase, setPhase] = useState<'splash' | 'agreement' | 'exit' | 'loading' | 'error'>('splash')
  const requestedPath = sanitizeReturnTo(params.get('returnTo'))
  const requestedMethod = params.get('loginMethod')
  const loginMethod: AuthMethod = requestedMethod === 'code' || requestedMethod === 'password' ? requestedMethod : 'one_tap'
  const requestedCloseTo = params.get('closeTo')
  const closeTo = requestedCloseTo ? sanitizeReturnTo(requestedCloseTo) : isGuestAccessiblePath(requestedPath) ? requestedPath : '/'
  const destination = buildLoginRoute(loginMethod, requestedPath, closeTo)

  useEffect(() => {
    if (phase !== 'splash') return undefined
    const timer = window.setTimeout(() => setPhase(authRepository.hasAcceptedInitialAgreement() ? 'loading' : 'agreement'), 2_000)
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
  if (phase === 'loading') return <main className="auth-v2-page auth-v2-launch-loading" data-node-id="511:11431">
    <StatusBar />
    <div><b>DG</b><strong>深度玩家</strong><span>一亿玩家自己的游戏平台</span><i role="status" aria-label="正在安全加载" /></div>
    <footer><span>资金托管 · 平台验号 · 客服介入</span><small>v1.1.0</small></footer>
  </main>
  return <main className="auth-v2-page auth-v2-welcome" data-node-id="511:11253">
    <StatusBar />
    <Brand />
    <p className="auth-v2-welcome-foot">深度玩家 · 玩家自己的交易平台</p>
    {phase === 'error' && <div className="auth-v2-load-error" role="alert"><span>协议状态保存失败</span><button type="button" onClick={() => setPhase('agreement')}><RotateCw size={15} />重试</button></div>}
    {(phase === 'agreement' || phase === 'exit') && <InitialAgreementDialog confirmExit={phase === 'exit'} onAgree={agree} onReject={() => phase === 'exit' ? navigate('/', { replace: true }) : setPhase('exit')} onContinue={() => setPhase('agreement')} />}
  </main>
}

type LoginMode = AuthMethod | 'code_entry'

export function LoginPage({ method }: { method: AuthMethod }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<LoginMode>(method)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [protocolPrompt, setProtocolPrompt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const countdown = getCountdown(cooldownUntil, now)
  const returnTo = useMemo(() => sanitizeReturnTo(params.get('returnTo') ?? (location.state as { returnTo?: string } | null)?.returnTo), [location.state, params])
  const closeTo = useMemo(() => sanitizeReturnTo(params.get('closeTo'), isGuestAccessiblePath(returnTo) ? returnTo : '/'), [params, returnTo])

  useEffect(() => {
    if (!countdown) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [countdown])
  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => navigate(returnTo, { replace: true }), 500)
    return () => window.clearTimeout(timer)
  }, [navigate, returnTo, success])

  const goToMethod = (next: AuthMethod) => navigate(buildLoginRoute(next, returnTo, closeTo))
  const requireAgreement = () => { if (agreed) return true; setProtocolPrompt(true); return false }
  const finish = async (request: () => ReturnType<typeof authRepository.loginOneTap>) => {
    setBusy(true); setError('')
    const result = await request()
    setBusy(false)
    if (!result.ok) { setError(result.error); return }
    setSuccess('登录成功，正在返回…')
  }
  const requestCode = async () => {
    setError('')
    const result = await authRepository.requestCode(phone)
    if (!result.ok) { setError(result.error); return }
    setCooldownUntil(result.cooldownUntil); setNow(Date.now()); setMode('code_entry')
  }
  const proceed = () => {
    if (method === 'one_tap') void finish(() => authRepository.loginOneTap(true))
    else if (mode === 'code_entry') void finish(() => authRepository.loginWithCode(phone, code, true))
    else if (method === 'password') void finish(() => authRepository.loginWithPassword(phone, password, true))
    else void requestCode()
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!requireAgreement()) return
    proceed()
  }

  const welcomeCopy = method === 'one_tap'
    ? '使用本机号码，快捷进入玩家交易世界'
    : method === 'password'
      ? '使用手机号与密码登录深度玩家'
      : mode === 'code_entry'
        ? `验证码已发送至 ${maskPhone(phone) || '当前手机号'}`
        : '验证码快捷登录，未注册手机号将自动创建账号'

  return <main className="auth-v2-page auth-v2-login" data-node-id={method === 'one_tap' ? '511:10305' : method === 'code' ? '511:10439' : '511:10566'}>
    <StatusBar />
    <nav className="auth-v2-login-nav" aria-label="登录页导航">
      <button type="button" onClick={() => navigate(closeTo, { replace: true })} aria-label="关闭登录，返回之前页面"><X size={21} /></button>
    </nav>
    <form className="auth-v2-login-body" onSubmit={submit} noValidate>
      <Brand compact />
      <header className="auth-v2-login-welcome">
        <h1>欢迎登录深度玩家</h1>
        <p>{welcomeCopy}</p>
      </header>
      {method === 'one_tap' ? <>
        <div className="auth-v2-one-tap-phone">{DEMO_MASKED_PHONE}</div>
        <button className="auth-v2-primary auth-v2-one-tap-action" type="submit" disabled={busy}>{busy ? '登录中…' : '本机号码一键登录'}</button>
        <div className="auth-v2-method-links"><button type="button" onClick={() => goToMethod('code')}>验证码登录</button><i /><button type="button" onClick={() => goToMethod('password')}>密码登录</button></div>
      </> : <>
        <label className="auth-v2-input"><b>+86</b><i /><input inputMode="numeric" autoComplete="tel" aria-label="手机号" value={phone} onChange={(event) => setPhone(normalizePhone(event.target.value))} placeholder="请输入手机号" disabled={mode === 'code_entry'} />{phone && mode !== 'code_entry' && <button type="button" aria-label="清空手机号" onClick={() => setPhone('')}><X size={13} /></button>}</label>
        {mode === 'code_entry' && <label className="auth-v2-input"><input inputMode="numeric" autoComplete="one-time-code" aria-label="验证码" value={code} onChange={(event) => setCode(normalizeCode(event.target.value))} placeholder="请输入6位验证码" autoFocus /><button type="button" className="auth-v2-code-link" disabled={countdown > 0} onClick={requestCode}>{countdown ? `${countdown}s` : '重新获取'}</button></label>}
        {method === 'password' && <><label className="auth-v2-input"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" aria-label="登录密码" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入登录密码" /><button type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></label><button type="button" className="auth-v2-forgot" onClick={() => setError('请联系玩家客服重置登录密码')}>忘记密码？</button></>}
        <button className="auth-v2-primary auth-v2-form-action" type="submit" disabled={busy}>{busy ? '提交中…' : mode === 'code' ? '获取验证码' : '登录'}</button>
        <div className="auth-v2-method-links"><button type="button" onClick={() => goToMethod('one_tap')}>本机号码一键登录</button><i /><button type="button" onClick={() => goToMethod(method === 'password' ? 'code' : 'password')}>{method === 'password' ? '验证码登录' : '密码登录'}</button></div>
        <small className="auth-v2-demo-hint">本地演示：登录信息不做真实性校验，输入任意内容即可继续。</small>
      </>}
      {(error || success) && <div className={`auth-v2-feedback ${success ? 'success' : ''}`} role={success ? 'status' : 'alert'}>{success || error}</div>}
      <AgreementCheck checked={agreed} onChange={() => setAgreed((value) => !value)} includePrivacy={method !== 'password'} />
    </form>
    {protocolPrompt && <div className="auth-v2-modal-layer login-prompt"><section className="auth-v2-dialog" role="dialog" aria-modal="true" aria-labelledby="login-protocol-title"><h2 id="login-protocol-title">请先阅读并同意协议</h2><p>继续登录前，需要你阅读并同意 <Link to="/user-agreement">《用户服务协议》</Link>{method !== 'password' && <> 和 <Link to="/privacy-policy">《隐私政策》</Link></>}。</p><footer><button type="button" className="secondary" onClick={() => setProtocolPrompt(false)}>暂不登录</button><button type="button" className="primary" onClick={() => { setAgreed(true); setProtocolPrompt(false); proceed() }}>同意并继续</button></footer></section></div>}
  </main>
}

function PolicyPage({ type }: { type: 'privacy' | 'agreement' }) {
  const navigate = useNavigate()
  const privacy = type === 'privacy'
  const sections: PolicySection[] = privacy ? privacySections : agreementSections
  return <main className="auth-v2-page auth-v2-policy" data-node-id={privacy ? '511:10647' : '511:10727'}>
    <header><StatusBar /><nav><button type="button" aria-label="返回" onClick={() => navigate(-1)}><ArrowLeft size={21} /></button></nav></header>
    <article>
      <h1>{privacy ? '深度玩家隐私政策' : '用户服务协议'}</h1>
      {privacy ? <div className="auth-v2-policy-meta"><dl><div><dt>应用名称</dt><dd>深度玩家</dd></div><div><dt>开发者名称</dt><dd>待法务确认</dd></div><div><dt>更新日期</dt><dd>{AUTH_POLICY_UPDATED_AT}</dd></div><div><dt>生效日期</dt><dd>{AUTH_POLICY_UPDATED_AT}</dd></div></dl></div>
        : <><p className="auth-v2-policy-date">更新时间 {AUTH_POLICY_UPDATED_AT}<span>生效时间 {AUTH_POLICY_UPDATED_AT}</span></p><section className="auth-v2-policy-important"><h2>重点条款提示</h2><ul><li>免除或限制平台责任的条款</li><li>对用户权利进行限制的条款</li><li>争议解决方式与司法管辖条款</li></ul><p>上述条款在正文中以加粗标示，请在同意前重点阅读。</p></section></>}
      {privacy && <nav className="auth-v2-policy-chips" aria-label="政策章节">{sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}</nav>}
      <div className="auth-v2-policy-copy">{sections.map((section) => <section id={section.id} key={section.id}><h2>{section.title}</h2>{section.paragraphs.map((paragraph, index) => <p key={index}>{privacy && section.id === 'notice' ? `${index + 1}. ` : ''}{paragraph}</p>)}</section>)}</div>
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
      <header><i><Bell size={18} /></i><h1 id="push-title">开启交易提醒？</h1></header>
      <p>开启后，卖家换绑、客服回复和付款倒计时会及时通知你，避免订单超时。</p>
      <small>你可以稍后在系统设置中修改。{current !== 'prompt' && ` 当前为${current === 'allowed' ? '已开启' : '未开启'}。`}</small>
      {error && <em role="alert">{error}</em>}
      <footer><button type="button" disabled={busy} onClick={() => choose('denied')}>暂不开启</button><button type="button" className="primary" disabled={busy} onClick={() => choose('allowed')}>{busy ? '设置中…' : '开启提醒'}</button></footer>
    </section>
  </main>
}
