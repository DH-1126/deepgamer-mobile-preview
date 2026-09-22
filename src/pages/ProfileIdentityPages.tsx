import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button, Dialog, Heading, TextField, Toast } from '../components/ui'
import { DEFAULT_ACCOUNT_PHONE, DEFAULT_NICKNAME, maskAccountPhone, validateAvatarFile, validateNewPhone, validateNickname, validatePhoneChallenge, type PhoneChallenge } from '../components/profileIdentityModel'
import { accountSettingsRepository } from '../repository/accountSettingsRepository'
import { DEMO_CODE } from '../data/authFixtures'
import { ProfileSettingsTopBar } from './ProfileSettingsPages'
import '../styles/profile-identity.css'

export function ProfileIdentityPage() {
  const [initial] = useState(() => accountSettingsRepository.getSnapshot())
  const [nickname, setNickname] = useState(initial.nickname || DEFAULT_NICKNAME)
  const [avatar, setAvatar] = useState(initial.avatarDataUrl || '')
  const [error, setError] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [reading, setReading] = useState(false)
  const [toast, setToast] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const readerRef = useRef<FileReader | null>(null)
  useEffect(() => () => readerRef.current?.abort(), [])
  const chooseAvatar = (file?: File) => {
    if (!file) return
    const issue = validateAvatarFile(file)
    setAvatarError(issue)
    if (issue) return
    setReading(true)
    const reader = new FileReader()
    readerRef.current = reader
    reader.onerror = () => { setReading(false); setAvatarError('图片读取失败，请重新选择') }
    reader.onload = () => {
      const data = String(reader.result)
      const image = new Image()
      image.onload = () => { setAvatar(data); setReading(false); setAvatarError('') }
      image.onerror = () => { setReading(false); setAvatarError('图片无法显示，请重新选择') }
      image.src = data
    }
    reader.readAsDataURL(file)
  }
  const save = (event: FormEvent) => {
    event.preventDefault()
    const issue = validateNickname(nickname)
    setError(issue)
    if (issue || reading) return
    if (!accountSettingsRepository.update({ nickname: nickname.trim(), avatarDataUrl: avatar })) { setToast('保存失败，内容已保留，请重试'); return }
    setNickname(nickname.trim()); setToast('头像与昵称已保存')
  }
  return <main className="profile-settings-v2-page">
    <ProfileSettingsTopBar title="头像与昵称" nodeId="account-security:profile" />
    <form className="profile-settings-v2-scroll profile-identity-form" onSubmit={save}>
      <section className="profile-identity-card profile-identity-avatar-card" aria-label="修改头像">
        <span className="profile-identity-avatar">{avatar ? <img src={avatar} alt="头像预览" /> : <UserRound size={36} aria-label="默认头像" />}</span>
        <div className="profile-identity-avatar-actions"><Button variant="outline" size="sm" disabled={reading} onClick={() => inputRef.current?.click()}>{reading ? '读取中…' : '选择图片'}</Button>{avatar && <Button variant="ghost" size="sm" disabled={reading} onClick={() => { setAvatar(''); setAvatarError('') }}>恢复默认头像</Button>}</div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => { chooseAvatar(event.target.files?.[0]); event.target.value = '' }} />
        <p>支持 JPG、PNG、WebP，大小不超过 2MB</p>{avatarError && <p className="profile-identity-error" role="alert">{avatarError}</p>}
      </section>
      <section className="profile-identity-card"><TextField label="昵称" aria-label="昵称" value={nickname} onChange={event => { setNickname(event.target.value); setError('') }} error={error} hint="1–20 个字符，保存后将展示在个人主页" autoComplete="nickname" /></section>
      <p className="profile-identity-note">修改仅用于本次本地演示，刷新页面后恢复默认。</p>
      <Button type="submit" fullWidth size="lg" disabled={reading}>保存</Button>
    </form>
    <Toast message={toast} onDismiss={() => setToast('')} />
  </main>
}

export function PhoneSettingsPage() {
  const navigate = useNavigate()
  const [currentPhone] = useState(() => accountSettingsRepository.getSnapshot().maskedPhone || DEFAULT_ACCOUNT_PHONE)
  const [step, setStep] = useState<'verify' | 'replace' | 'success'>('verify')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<PhoneChallenge | null>(null)
  const [now, setNow] = useState(Date.now())
  const [phoneError, setPhoneError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [toast, setToast] = useState('')
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  const target = step === 'verify' ? currentPhone : phone
  const cooldown = challenge ? Math.max(0, Math.ceil((challenge.resendAt - now) / 1000)) : 0
  const requestCode = () => {
    const issue = step === 'replace' ? validateNewPhone(phone) : ''
    setPhoneError(issue)
    if (issue || cooldown > 0) return
    const at = Date.now()
    setNow(at); setChallenge({ target, expiresAt: at + 5 * 60_000, resendAt: at + 60_000 }); setCodeError(''); setToast(`演示验证码：${DEMO_CODE}，未发送短信`)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const issue = step === 'replace' ? validateNewPhone(phone) : ''
    const verification = validatePhoneChallenge(challenge, target, code, Date.now())
    setPhoneError(issue); setCodeError(verification)
    if (issue || verification) return
    if (step === 'verify') { setStep('replace'); setCode(''); setChallenge(null); return }
    setConfirming(true)
  }
  const confirmPhone = () => {
    const issue = validateNewPhone(phone) || validatePhoneChallenge(challenge, phone, code, Date.now())
    if (issue) { setConfirming(false); setCodeError(issue); return }
    if (!accountSettingsRepository.update({ maskedPhone: maskAccountPhone(phone) })) { setToast('换绑失败，内容已保留，请重试'); return }
    setConfirming(false); setCode(''); setChallenge(null); setStep('success')
  }
  return <main className="profile-settings-v2-page">
    <ProfileSettingsTopBar title="更换手机号" nodeId="account-security:phone" />
    {step === 'success' ? <div className="profile-settings-v2-scroll profile-identity-form"><section className="profile-identity-card profile-identity-success"><CheckCircle2 size={44} /><Heading variant="result">手机号换绑成功</Heading><p>当前手机号：{maskAccountPhone(phone)}</p></section><Button fullWidth size="lg" onClick={() => navigate('/account-security', { replace: true })}>返回账号与安全</Button></div>
      : <form className="profile-settings-v2-scroll profile-identity-form" onSubmit={submit} noValidate>
        <header className="profile-identity-intro"><small>步骤 {step === 'verify' ? '1 / 2' : '2 / 2'}</small><Heading variant="section">{step === 'verify' ? '验证当前手机号' : '绑定新手机号'}</Heading><p>当前手机号：{currentPhone}</p></header>
        <section className="profile-identity-card">
          {step === 'replace' && <TextField label="新手机号" aria-label="新手机号" type="tel" inputMode="tel" maxLength={11} value={phone} autoComplete="tel-national" placeholder="请输入新手机号" error={phoneError} onChange={event => { setPhone(event.target.value.replace(/\D/g, '').slice(0, 11)); setPhoneError(''); setCodeError(''); setCode(''); setChallenge(null) }} />}
          <TextField label="验证码" aria-label="验证码" inputMode="numeric" maxLength={6} autoComplete="one-time-code" value={code} placeholder="请输入6位验证码" error={codeError} onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setCodeError('') }} trailing={<Button variant="ghost" size="sm" disabled={cooldown > 0} onClick={requestCode}>{cooldown ? `${cooldown}s后重发` : '获取验证码'}</Button>} />
        </section>
        <p className="profile-identity-note">本地演示不发送真实短信。点击获取后，使用验证码 {DEMO_CODE}，5 分钟内有效；仅保存脱敏手机号。</p>
        <Button type="submit" fullWidth size="lg">{step === 'verify' ? '下一步' : '确认更换'}</Button>
      </form>}
    <Dialog open={confirming} onClose={() => setConfirming(false)} title="确认更换手机号？" actions={<><Button variant="outline" onClick={() => setConfirming(false)}>取消</Button><Button onClick={confirmPhone}>确认换绑</Button></>}><p>新的手机号为 {phone ? maskAccountPhone(phone) : ''}，确认后将更新账号与安全中的显示。</p></Dialog>
    <Toast message={toast} onDismiss={() => setToast('')} />
  </main>
}
