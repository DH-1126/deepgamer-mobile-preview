import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { Button, Dialog, IconButton, TextField } from './ui'
import { getCountdown, maskPhone, normalizeCode } from './authModel'
import { passwordRequirements } from './accountSettingsModel'
import { authRepository } from '../repository/authRepository'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import '../styles/auth-verification.css'

export type AuthVerificationIntent =
  | { mode: 'register'; phone: string; password: string }
  | { mode: 'reset'; phone: string; trigger: 'attempts' | 'manual' }

type FieldErrors = { password?: string; confirmation?: string; code?: string }
type Props = { intent: AuthVerificationIntent; onClose: () => void; onSuccess: () => void }

/** Password-login verification: composed from the same dialog/field/button primitives as the app. */
export function AuthVerificationDialog({ intent, onClose, onSuccess }: Props) {
  const resetting = intent.mode === 'reset'
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [visible, setVisible] = useState({ password: false, confirmation: false })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [cooldownUntil, setCooldownUntil] = useState(() => authRepository.getPasswordCodeCooldown(intent.phone, intent.mode))
  const countdown = getCountdown(cooldownUntil, now)
  const mounted = useRef(true)
  const pending = useRef(false)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmationRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const busy = sending || submitting

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!countdown) return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [countdown])

  const change = (field: keyof FieldErrors, value: string) => {
    if (field === 'password') setPassword(value)
    else if (field === 'confirmation') setConfirmation(value)
    else setCode(normalizeCode(value))
    setErrors(previous => ({ ...previous, [field]: undefined }))
    setError('')
  }
  const sendCode = async () => {
    if (pending.current || countdown) return
    pending.current = true
    setSending(true); setError('')
    try {
      const result = await authRepository.requestPasswordCode(intent.phone, intent.mode)
      if (!mounted.current) return
      if (!result.ok) { setError(result.error); return }
      setCooldownUntil(result.cooldownUntil); setNow(Date.now()); setSent(true)
      setErrors(previous => ({ ...previous, code: undefined }))
      codeRef.current?.focus()
    } catch {
      if (mounted.current) setError('验证码发送失败，请稍后重试')
    } finally {
      pending.current = false
      if (mounted.current) setSending(false)
    }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending.current) return
    const next: FieldErrors = {}
    if (resetting) {
      const checks = passwordRequirements(password, confirmation)
      if (!checks.length || !checks.composition) next.password = '密码需为 8-18 位，并同时包含字母和数字'
      if (!checks.matches) next.confirmation = '两次输入的密码不一致'
    }
    if (!/^\d{6}$/.test(code)) next.code = code ? '请输入 6 位验证码' : '请输入验证码'
    setErrors(next); setError('')
    if (Object.keys(next).length) {
      ;(next.password ? passwordRef : next.confirmation ? confirmationRef : codeRef).current?.focus()
      return
    }
    pending.current = true
    setSubmitting(true)
    try {
      const result = intent.mode === 'register'
        ? await authRepository.registerWithCode(intent.phone, intent.password, code, true)
        : await authRepository.resetPasswordWithCode(intent.phone, password, confirmation, code, true)
      if (!mounted.current) return
      if (!result.ok) {
        if (result.field) setErrors({ [result.field]: result.error })
        else setError(result.error)
        return
      }
      onSuccess()
    } catch {
      if (mounted.current) setError('提交失败，请稍后重试')
    } finally {
      pending.current = false
      if (mounted.current) setSubmitting(false)
    }
  }
  const passwordField = (field: 'password' | 'confirmation', label: string, placeholder: string) => <TextField
    ref={field === 'password' ? passwordRef : confirmationRef}
    label={label} aria-label={label} placeholder={placeholder}
    type={visible[field] ? 'text' : 'password'} autoComplete="new-password" maxLength={18}
    value={field === 'password' ? password : confirmation} disabled={busy}
    onChange={event => change(field, event.target.value)} error={errors[field]}
    leading={<span className="auth-verification__lock"><LockKeyhole size={18} aria-hidden="true" /></span>}
    trailing={<IconButton label={`${visible[field] ? '隐藏' : '显示'}${label}`} aria-pressed={visible[field]} variant="soft" disabled={busy} onClick={() => setVisible(previous => ({ ...previous, [field]: !previous[field] }))}>{visible[field] ? <EyeOff size={18} /> : <Eye size={18} />}</IconButton>}
  />

  return <Dialog open title={resetting ? '找回密码' : '验证手机号'} onClose={() => { if (!pending.current) onClose() }} closeOnBackdrop={false} className="auth-verification">
    <p className="auth-verification__description">{resetting ? <>{intent.trigger === 'attempts' && <>密码多次输入错误<br /></>}请设置新密码，并完成短信验证。</> : <>当前手机号尚未注册<br />验证通过后将自动注册登录并设置您已输入的密码</>}</p>
    <p className="auth-verification__phone">{maskPhone(intent.phone)}</p>
    <form className="auth-verification__form" noValidate onSubmit={submit} aria-busy={busy}>
      {resetting && <>{passwordField('password', '新密码', '请输入新密码')}{passwordField('confirmation', '确认新密码', '请再次输入新密码')}</>}
      <div className="auth-verification__code-row">
        <TextField ref={codeRef} label={resetting ? '验证码' : undefined} aria-label="验证码" placeholder={resetting ? '请输入验证码' : '请输入 6 位验证码'} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy} onChange={event => change('code', event.target.value)} error={errors.code} />
        <Button className="auth-verification__send" variant="secondary" loading={sending} disabled={busy || countdown > 0} onClick={sendCode}>{countdown ? `${countdown}s 后重发` : sent ? '重新获取' : '获取验证码'}</Button>
      </div>
      {sent && <p className="auth-verification__sent" role="status">验证码已发送，请留意短信</p>}
      {error && <p className="auth-verification__error" role="alert">{error}</p>}
      <Button className="auth-verification__submit" type="submit" fullWidth size="xl" loading={submitting} disabled={sending}>{resetting ? '确认重置' : '注册并登录'}</Button>
    </form>
    <p className="auth-verification__support">收不到验证码？ <Link to={SUPPORT_CONVERSATION_ROUTE}>联系客服</Link></p>
  </Dialog>
}
