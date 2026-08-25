import { ArrowLeft, Check } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fulfillmentRepository } from '../repository/fulfillmentRepository'
import { getContractSubmitIssue } from '../components/fulfillmentModel'
import { assetPath } from '../components/assetPath'
import type { FulfillmentContract } from '../types/fulfillment'
import '../styles/fulfillment-v2.css'

export function FulfillmentContractPage() {
  const { contractId = '' } = useParams()
  const navigate = useNavigate()
  const [contract, setContract] = useState<FulfillmentContract>()
  const [loading, setLoading] = useState(true)
  const [signature, setSignature] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showFull, setShowFull] = useState(false)
  useEffect(() => { void fulfillmentRepository.get(contractId).then((value) => { setContract(value); setSignature(value?.signature ?? ''); setAgreed(value?.status === 'signed'); setLoading(false) }) }, [contractId])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!contract || !signature.trim() || !agreed || contract.status === 'signed') return
    setSubmitting(true); const next = await fulfillmentRepository.sign(contract.id, signature); setContract(next); setSubmitting(false)
  }
  if (loading) return <main className="fulfillment-contract-page"><div className="contract-state">正在加载合同…</div></main>
  if (!contract) return <main className="fulfillment-contract-page"><div className="contract-state"><h1>合同不存在</h1><Link to="/message">返回消息</Link></div></main>
  const amount = (contract.amountCents / 100).toLocaleString('zh-CN')
  const signed = contract.status === 'signed'
  const submitIssue = getContractSubmitIssue(signature, agreed)
  return <main className="fulfillment-contract-page">
    <header><div className="contract-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div><div className="contract-title"><button type="button" aria-label="返回" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button><h1>{signed ? '合同已签署' : '签署回收合同'}</h1><span /></div></header>
    <form onSubmit={submit}>
      <div className="contract-scroll">
        <section className="contract-summary"><div><Check size={13} /><b>{signed ? '合同已签署 · 本地演示' : '资料已提交 · 待签署'}</b><small>#{contract.orderNo}</small></div><article><strong><i>¥</i>{amount}</strong><span>预计到手<b>¥{amount}</b></span></article><footer><span>{contract.gameName} {contract.serverName} · {contract.recyclerName}</span><em>{signed ? '已完成' : '剩 26:03'}</em></footer></section>
        <h2 className="contract-section-label">合同正文</h2>
        <section className="contract-document"><header><span><b>游戏账号回收协议</b><small>#{contract.orderNo}</small></span><button type="button" onClick={() => setShowFull((value) => !value)}>{showFull ? '收起全文' : '查看全文'}</button></header><article className={showFull ? 'expanded' : ''}><h3>一 · 交易主体</h3><p>出让方为账号实名持有人，受让方为回收商「{contract.recyclerName}」，深度玩家平台提供资金托管与验号服务。</p><h3>二 · 回收价款</h3><p>本次回收价款为 ¥{amount}，手续费由回收商承担，验号通过并完成换绑后打款至出让方余额。</p><h3>三 · 出让方承诺</h3><p>出让方承诺账号为本人所有、来源合法、无封禁与权属纠纷，换绑完成后不再主张任何账号权利，不进行申诉或找回。</p><h3>四 · 违约与争议</h3><p>若因出让方原因导致账号无法正常交付或被找回，平台有权终止交易并追回已付价款。</p><aside>演示文案：正式合同条款须由法务与合规团队确认后提供。</aside></article></section>
        <h2 className="contract-section-label">签署信息</h2>
        <section className="contract-signer"><div><span>签署人</span><b>{contract.signerMasked}</b></div><div><span>证件号</span><b>{contract.identityMasked}</b></div><label><span>手写签名<small>本地演示签名，不产生法律效力</small></span><input value={signature} disabled={signed} onChange={(event) => setSignature(event.target.value)} placeholder="输入本人姓名作为演示签名" aria-label="演示签名" /></label></section>
        <label className="contract-agree"><input type="checkbox" checked={agreed} disabled={signed} onChange={(event) => setAgreed(event.target.checked)} /><span>我已阅读并同意 <b>《游戏账号回收协议》</b> 全部条款</span></label>
      </div>
      <footer className="contract-actions"><button type="button" onClick={() => navigate(-1)}>{signed ? '返回群聊' : '稍后签'}</button><button type="submit" disabled={signed || submitting || Boolean(submitIssue)}>{signed ? '已签署' : submitting ? '提交中…' : '签署并提交'}<small>{!signed && submitIssue ? submitIssue : signed ? '本地演示状态已保存' : '演示提交，不具法律效力'}</small></button></footer>
    </form>
  </main>
}
