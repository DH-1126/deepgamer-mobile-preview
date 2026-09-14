import { useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, Check, ChevronLeft, Clock3, Info, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, Dialog, Heading, IconButton, PageHeader, Spinner, StatusBar, TextField } from '../components/ui'
import { maskRealName, maskRealNameId, parseRealNameScenario, validateRealName, type RealNameScenario } from '../components/realNameModel'
import { accountSettingsRepository } from '../repository/accountSettingsRepository'
import '../styles/realname-v2.css'

const DEMO_NAME = '邓小明'
const DEMO_ID = '420101199001012214'

function StateIcon({ kind }: { kind: 'success' | 'reviewing' | 'rejected' }) {
  if (kind === 'success') return <Check size={38} strokeWidth={2.4} aria-hidden="true" />
  if (kind === 'reviewing') return <Clock3 size={34} strokeWidth={2} aria-hidden="true" />
  return <X size={35} strokeWidth={2.2} aria-hidden="true" />
}

export function RealNamePage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  const requested = new URLSearchParams(search).get('scenario')
  const persisted = accountSettingsRepository.getSnapshot().realNameStatus
  const fallback: RealNameScenario = persisted === 'reviewing' ? 'reviewing' : persisted === 'rejected' ? 'rejected' : persisted === 'unverified' ? 'fill' : 'success'
  const initial = parseRealNameScenario(requested, fallback)
  const [scenario, setScenario] = useState<RealNameScenario>(initial)
  const [name, setName] = useState(initial === 'fill' ? '' : DEMO_NAME)
  const [citizenId, setCitizenId] = useState(initial === 'fill' ? '' : DEMO_ID)
  const [errors, setErrors] = useState({ name: '', citizenId: '' })
  const [masked, setMasked] = useState({ name: maskRealName(DEMO_NAME), id: maskRealNameId(DEMO_ID) })
  const outcome = new URLSearchParams(search).get('outcome')

  useEffect(() => {
    if (scenario !== 'submitting') return undefined
    if (requested === 'submitting') return undefined
    const timer = window.setTimeout(() => {
      setName(''); setCitizenId('')
      if (outcome === 'failure') setScenario('failure')
      else { accountSettingsRepository.update({ realNameStatus: 'reviewing' }); setScenario('reviewing') }
    }, 850)
    return () => window.clearTimeout(timer)
  }, [outcome, requested, scenario])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const next = validateRealName(name, citizenId)
    setErrors(next)
    if (next.name || next.citizenId) return
    setMasked({ name: maskRealName(name), id: maskRealNameId(citizenId) })
    setScenario('confirm')
  }
  const previewFill = () => { setName(''); setCitizenId(''); setErrors({ name: '', citizenId: '' }); setScenario('fill') }
  const previewSuccess = () => { setName(''); setCitizenId(''); setErrors({ name: '', citizenId: '' }); setScenario('success') }
  const restart = () => { accountSettingsRepository.update({ realNameStatus: 'unverified' }); setName(''); setCitizenId(''); setErrors({ name: '', citizenId: '' }); setScenario('fill') }
  const back = () => window.history.length > 1 ? navigate(-1) : navigate('/settings')

  return <main className="realname-v2-page" data-scenario={scenario} data-node-id={scenario === 'fill' ? '4053:8196' : undefined}>
    <StatusBar />
    <PageHeader className="realname-v2-topbar" title="实名认证" left={<IconButton label="返回" onClick={back}><ChevronLeft size={24} strokeWidth={2} aria-hidden="true" /></IconButton>} />
    <div className="realname-v2-scroll">
      {scenario === 'fill' || scenario === 'confirm' || scenario === 'submitting' || scenario === 'failure' ? <>
        <header className="realname-v2-intro"><div><Heading variant="hero">填写实名信息</Heading><p>用于保障交易安全，提交后不可自行修改</p></div>{scenario === 'fill' && <button className="realname-v2-fill-preview" type="button" onClick={previewSuccess} aria-label="预览已实名状态"><Check size={20} strokeWidth={2.5} aria-hidden="true" /></button>}</header>
        <form className="realname-v2-form" onSubmit={submit} noValidate>
          <section className="realname-v2-form-card">
            <TextField label="真实姓名" value={name} onChange={(event) => { setName(event.target.value); setErrors((current) => ({ ...current, name: '' })) }} placeholder="请输入本人真实姓名" autoComplete="name" maxLength={20} error={errors.name} />
            <TextField label="身份证号码" value={citizenId} onChange={(event) => { setCitizenId(event.target.value); setErrors((current) => ({ ...current, citizenId: '' })) }} placeholder="请输入18位身份证号码" autoComplete="off" maxLength={18} error={errors.citizenId} />
          </section>
          <aside className="realname-v2-protection"><ShieldCheck size={18} aria-hidden="true" /><p><b>信息安全保障</b><br />身份信息仅用于实名认证，平台将严格加密保护。</p></aside>
          <Button className="realname-v2-primary" type="submit" fullWidth>提交认证</Button>
        </form>
      </> : <RealNameResult scenario={scenario} name={masked.name} id={masked.id} onBack={back} onRestart={restart} onPreviewFill={previewFill} />}
    </div>

    <Dialog open={scenario === 'confirm'} onClose={() => setScenario('fill')} title="确认实名信息" actions={<><Button variant="outline" onClick={() => setScenario('fill')}>返回修改</Button><Button onClick={() => setScenario('submitting')}>确认提交</Button></>}><p>提交后不可自行修改，请确认信息无误</p><dl><div><dt>真实姓名</dt><dd>{masked.name}</dd></div><div><dt>身份证号码</dt><dd>{masked.id}</dd></div></dl><p><Info size={16} aria-hidden="true" />请确认使用本人身份信息进行认证</p></Dialog>
    {scenario === 'submitting' && <BusyDialog title="正在提交认证" nodeId="4053:8327" />}
    {scenario === 'failure' && <div className="realname-v2-modal-layer" data-node-id="4053:8525"><section role="alertdialog" aria-modal="true" aria-labelledby="realname-failure-title"><span className="error"><AlertCircle size={18} /></span><Heading id="realname-failure-title" variant="dialog">提交失败</Heading><p>认证信息提交失败，请稍后重试。<br />已填写的信息仍为你保留。</p><footer><button type="button" onClick={() => setScenario('fill')}>返回修改</button><button className="primary" type="button" onClick={() => setScenario('submitting')}>重新提交</button></footer></section></div>}
  </main>
}

function BusyDialog({ title, nodeId }: { title: string; nodeId: string }) {
  return <Dialog open onClose={() => undefined} showClose={false} title={title} className="realname-v2-busy-dialog"><div data-node-id={nodeId}><Spinner size="lg" label={title} /><p>请稍候…</p></div></Dialog>
}

function RealNameResult({ scenario, name, id, onBack, onRestart, onPreviewFill }: { scenario: Extract<RealNameScenario, 'reviewing' | 'success' | 'rejected'>; name: string; id: string; onBack: () => void; onRestart: () => void; onPreviewFill: () => void }) {
  const meta = scenario === 'reviewing'
    ? { title: '认证审核中', description: '平台正在核验你的身份信息\n预计 1 个工作日内完成', kind: 'reviewing' as const, node: '4053:8359' }
    : scenario === 'success'
      ? { title: '认证成功', description: '你的实名认证已通过\n现在可以安全地进行交易', kind: 'success' as const, node: '4053:8417' }
      : { title: '认证未通过', description: '身份信息校验未通过\n请核对后重新认证', kind: 'rejected' as const, node: '4053:8467' }
  return <section className={`realname-v2-result-page ${scenario}`} data-node-id={meta.node}>
    <section className="realname-v2-result-card"><button className="realname-v2-result-preview" type="button" onClick={onPreviewFill} aria-label={`预览未实名填写状态，当前${meta.title}`}><StateIcon kind={meta.kind} /></button><Heading variant="result">{meta.title}</Heading><p>{meta.description.split('\n').map((line) => <span key={line}>{line}</span>)}</p>{scenario === 'reviewing' && <small>提交于 09-10 15:12</small>}</section>
    {scenario === 'rejected' && <section className="realname-v2-reason"><b>未通过原因</b><p>身份信息校验失败</p><small>姓名或身份证号码与权威数据源不一致</small></section>}
    <section className="realname-v2-info"><div><span>真实姓名</span><b>{name}</b></div><div><span>身份证号码</span><b>{id}</b></div><div><span>{scenario === 'success' ? '认证时间' : scenario === 'reviewing' ? '当前状态' : '审核时间'}</span><b className={scenario}>{scenario === 'success' ? '09-10 15:18' : scenario === 'reviewing' ? '审核中' : '09-10 15:24'}</b></div></section>
    <aside className="realname-v2-note"><Info size={15} aria-hidden="true" />{scenario === 'success' ? '认证信息仅展示脱敏结果，暂不支持自行修改。' : scenario === 'reviewing' ? '审核期间无需重复提交，请留意系统通知。' : '重新提交前，请确认姓名与身份证件信息完全一致。'}</aside>
    <footer>{scenario === 'rejected' ? <><button type="button" onClick={onBack}>返回</button><button className="primary" type="button" onClick={onRestart}><RotateCcw size={15} />重新认证</button></> : <button className={scenario === 'success' ? 'primary' : ''} type="button" onClick={onBack}>返回</button>}</footer>
  </section>
}
