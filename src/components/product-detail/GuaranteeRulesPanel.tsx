import { FullScreenPanel, Heading, IconButton, StatusBar } from '../ui'
import { assetPath } from '../assetPath'
import './guarantee-rules.css'

export type GuaranteeRulesPanelProps = {
  open: boolean
  onClose: () => void
}

const rules = [
  {
    title: '一 · 找回包赔是什么意思',
    body: '您购买的账号后，若出现找回，在保障期内，出现账号找回，平台将进行赔付（您购买后出租、出借、转让、主动泄露账密等情况除外）。',
  },
  {
    title: '二 · 卖号后还能申诉找回吗？',
    body: '不可以。交易完成后账号归属已变更，恶意申诉找回属于违约，平台有权追责并按包赔规则处理。',
  },
  {
    title: '三 · 包赔额度是多少？',
    body: '根据您购买的包赔类型进行赔付，具体以平台政策为主。',
  },
  {
    title: '四 · 找回包赔怎么申请？',
    body: '在订单交易群 / 客服渠道提供：①找回 / 被盗的证据（游戏内截图 + 申诉记录）②原始订单号 ③情况说明；平台按 "包赔规则说明" 处理。',
  },
  {
    title: '五 · "服务保障" 四项分别是什么？',
    body: '①找回包赔 —— 保障期内按规则处理 ②安全交易 —— 订单记录留痕 ③专属客服 —— 1 对 1 跟进 ④交易协助 —— 付款后交易群 + 按步骤验号 / 换绑。',
  },
]

/** Latest product-detail guarantee rules. It remains route-neutral so the detail page controls its own history. */
export function GuaranteeRulesPanel({ open, onClose }: GuaranteeRulesPanelProps) {
  return <FullScreenPanel open={open} onClose={onClose} title="保障规则" className="guarantee-rules-panel" header={<>
    <StatusBar className="guarantee-rules-panel__status" />
    <header className="guarantee-rules-panel__nav">
      <IconButton label="返回商品详情" onClick={onClose}>
        <img src={assetPath('assets/product-detail-draft5/back.svg')} alt="" width={20} height={20} />
      </IconButton>
    </header>
  </>}>
    <article className="guarantee-rules-panel__content">
      <Heading as="h2" variant="dialog">保障规则</Heading>
      <p className="guarantee-rules-panel__dates"><span>更新时间 <b>2026-08-18</b></span><span>生效时间 <b>2026-08-18</b></span></p>
      {rules.map(rule => <section key={rule.title} className="guarantee-rules-panel__rule">
        <Heading as="h3" variant="subsection">{rule.title}</Heading>
        <p>{rule.body}</p>
      </section>)}
    </article>
  </FullScreenPanel>
}
