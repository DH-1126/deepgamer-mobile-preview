import { useRef, useState, type ChangeEvent } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ImagePlus,
  Lightbulb,
  MessageSquareText,
  Users,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { assetPath } from '../components/assetPath'
import '../styles/feedback-draft3.css'

type FeedbackType = 'service' | 'product' | 'community'
type FeedbackScreen = 'form' | 'history'

const feedbackTypes = [
  { value: 'service' as const, label: '吐槽服务', detail: '不满意？欢迎说。客服、验号、换绑体验', Icon: MessageSquareText },
  { value: 'product' as const, label: '产品建议', detail: '好点子被采纳，有机会得到奖励', Icon: Lightbulb },
  { value: 'community' as const, label: '社区共建', detail: '平台文化，玩家一起定义', Icon: Users },
]

const suggestionDirections = ['买号筛选', '商品详情', '下单与支付', '消息通知', '卖号发布', '其他']

const historyItems = [
  {
    type: '产品建议', status: '处理中', tone: 'processing', date: '09-04',
    content: '买号页筛选里希望能直接搜皮肤名，另外希望收藏的号降价时能推送提醒。',
  },
  {
    type: '吐槽服务', status: '已回复', tone: 'replied', date: '08-27',
    content: '换绑等了两个多小时才有客服回，中途也没有进度提示。',
    reply: '已把换绑排队进度加进交易群提示，晚间时段客服人力也做了调整，感谢反馈。',
  },
  {
    type: '产品建议', status: '已采纳', tone: 'adopted', date: '08-12',
    content: '希望商品详情能看到同类账号的价格区间，判断贵不贵。',
    reply: '「同类价格」已在最新版商品详情上线，可在推荐分栏查看。',
  },
]

function FeedbackStatusBar() {
  return <div className="feedback-d3-status" aria-hidden="true">
    <time>9:41</time>
    <span>
      <img src={assetPath('assets/home-v2/status-signal.svg')} alt="" />
      <img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" />
      <img src={assetPath('assets/home-v2/status-battery.svg')} alt="" />
    </span>
  </div>
}

export function FeedbackPage() {
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const [screen, setScreen] = useState<FeedbackScreen>('form')
  const [submitted, setSubmitted] = useState(false)
  const [type, setType] = useState<FeedbackType | null>(null)
  const [directions, setDirections] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [qq, setQq] = useState('')
  const [publicDisplay, setPublicDisplay] = useState(false)
  const [previews, setPreviews] = useState<string[]>([])

  const canSubmit = Boolean(type && content.trim())

  const reset = () => {
    setType(null)
    setDirections([])
    setContent('')
    setQq('')
    setPublicDisplay(false)
    setPreviews([])
    setSubmitted(false)
    setScreen('form')
  }

  const toggleDirection = (value: string) => {
    setDirections((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  const loadImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 3 - previews.length)
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => setPreviews((current) => [...current, String(reader.result)].slice(0, 3))
      reader.readAsDataURL(file)
    })
    event.target.value = ''
  }

  const submit = () => {
    if (!canSubmit) return
    setSubmitted(true)
    setScreen('history')
  }

  return <main className="feedback-d3-page">
    <FeedbackStatusBar />
    <header className="feedback-d3-topbar">
      <button type="button" onClick={() => screen === 'history' ? setScreen('form') : navigate(-1)} aria-label="返回"><ArrowLeft size={21} /></button>
      <h1>{screen === 'history' ? '我的反馈' : '吐槽广场'}</h1>
      {screen === 'form'
        ? <button className="feedback-d3-history-link" type="button" onClick={() => setScreen('history')}>我的反馈</button>
        : <span />}
    </header>

    {screen === 'form' ? <>
      <div className="feedback-d3-scroll">
        {!type && <section className="feedback-d3-intro">
          <span><MessageSquareText size={22} /></span>
          <div><h2>直接说，我们在看</h2><p>哪里难用、客服哪里不爽、想要什么新功能</p></div>
        </section>}

        <section className="feedback-d3-section">
          <h2>选择类型 <em>*</em></h2>
          {!type ? <div className="feedback-d3-type-cards">
            {feedbackTypes.map(({ value, label, detail, Icon }) => <button type="button" key={value} onClick={() => setType(value)}>
              <span className="feedback-d3-type-icon"><Icon size={20} /></span>
              <span><b>{label}</b><small>{detail}</small></span>
              <i aria-hidden="true" />
            </button>)}
          </div> : <div className="feedback-d3-chips">
            {feedbackTypes.map(({ value, label }) => <button type="button" key={value} className={type === value ? 'active' : ''} onClick={() => setType(value)}>
              {type === value && <Check size={13} strokeWidth={3} />}{label}
            </button>)}
          </div>}
        </section>

        {type === 'product' && <section className="feedback-d3-section">
          <h2>建议方向 <small>（可多选）</small></h2>
          <div className="feedback-d3-direction-chips">{suggestionDirections.map((value) => <button type="button" className={directions.includes(value) ? 'active' : ''} key={value} onClick={() => toggleDirection(value)}>{value}</button>)}</div>
        </section>}

        <section className="feedback-d3-section">
          <h2>想说什么 <em>*</em></h2>
          <label className="feedback-d3-textarea">
            <textarea maxLength={500} value={content} onChange={(event) => setContent(event.target.value)} placeholder="说得越具体越好：在哪个页面、想做什么、遇到了什么" />
            <small>{content.length}/500</small>
          </label>
        </section>

        <section className="feedback-d3-section">
          <h2>上传截图 <small>（选填，最多 3 张）</small></h2>
          <div className="feedback-d3-uploads">
            {previews.map((src, index) => <figure key={`${src.slice(-20)}-${index}`}>
              <img src={src} alt={`反馈截图 ${index + 1}`} />
              <button type="button" aria-label={`删除第 ${index + 1} 张截图`} onClick={() => setPreviews((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={12} /></button>
            </figure>)}
            {previews.length < 3 && <button type="button" className="feedback-d3-upload" onClick={() => fileInput.current?.click()}><ImagePlus size={22} /><small>{previews.length}/3</small></button>}
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={loadImages} />
          </div>
        </section>

        <section className="feedback-d3-contact">
          <h2>联系方式 <small>（选填）</small></h2>
          <div><span><b>手机号</b><small>187****0033</small></span><button type="button">更换</button></div>
          <label><span>微信 / QQ</span><input value={qq} onChange={(event) => setQq(event.target.value)} placeholder="选填，方便我们追问细节" /></label>
        </section>

        <p className="feedback-d3-note">联系方式仅用于反馈沟通，不会对外展示。</p>
        <button type="button" className={`feedback-d3-public ${publicDisplay ? 'checked' : ''}`} onClick={() => setPublicDisplay((value) => !value)}>
          <i>{publicDisplay && <Check size={12} strokeWidth={3} />}</i><span>允许平台在社区公开展示我的建议（不含联系方式）</span>
        </button>
      </div>
      <footer className="feedback-d3-submit">
        <button type="button" disabled={!canSubmit} onClick={submit}>提交反馈</button>
        <small>{canSubmit ? '被采纳的建议会通过站内消息通知你' : '选择类型并填写内容后可提交'}</small>
      </footer>
    </> : <FeedbackHistory submitted={submitted} onReset={reset} onHome={() => navigate('/')} />}
  </main>
}

function FeedbackHistory({ submitted, onReset, onHome }: { submitted: boolean; onReset: () => void; onHome: () => void }) {
  return <div className="feedback-d3-history-scroll">
    {submitted && <section className="feedback-d3-success">
      <span><Check size={27} strokeWidth={3} /></span>
      <h2>已收到，谢谢你说出来</h2>
      <p>产品团队会在 3 个工作日内查看。被采纳时会通过站内消息通知你。</p>
      <div><button type="button" onClick={onReset}>再提一条</button><button type="button" onClick={onHome}>回首页</button></div>
    </section>}
    <section className="feedback-d3-history-list">
      <header><h2>我提过的</h2><span>{historyItems.length}条</span></header>
      {historyItems.map((item) => <article key={`${item.date}-${item.content}`}>
        <header><span><b>{item.type}</b><em className={item.tone}>{item.status}</em></span><time>{item.date}</time></header>
        <p>{item.content}</p>
        {item.reply && <blockquote><b>官方回复</b><p>{item.reply}</p></blockquote>}
        <button type="button" aria-label="查看反馈详情"><ChevronRight size={17} /></button>
      </article>)}
    </section>
  </div>
}
