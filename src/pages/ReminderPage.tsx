import { ArrowLeft, Check, Clock3, FileText, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Heading, IconButton, PageHeader } from '../components/ui'
import { DesignPromptTrigger } from '../components/DesignPromptTrigger'
import '../styles/reminder-draft3.css'

type ReminderKind = 'payment' | 'favorite' | 'recycle' | 'agreement'

type ReminderItem = {
  id: string
  group: '今天' | '更早'
  kind: ReminderKind
  title: string
  detail: string
  time: string
  unread: boolean
  route: string
}

const reminderFixtures: ReminderItem[] = [
  { id: 'payment', group: '今天', kind: 'payment', title: '订单待付款', detail: '王者荣耀订单还剩 24 分钟，超时将自动取消。', time: '09:38', unread: true, route: '/orders?role=buyer&status=pending' },
  { id: 'favorite', group: '今天', kind: 'favorite', title: '收藏的号降价了', detail: '王者50★ 108英雄 降价 ¥120，现价 ¥1,280。', time: '08:20', unread: true, route: '/favorites' },
  { id: 'recycle', group: '更早', kind: 'recycle', title: '回收账号已通过验收', detail: '王者荣耀 QQ区 星耀2 已通过平台验收。', time: '08-19', unread: false, route: '/message?tab=recycle' },
  { id: 'agreement', group: '更早', kind: 'agreement', title: '平台规则更新', detail: '交易保障规则已更新，点击查看变更内容。', time: '08-15', unread: false, route: '/privacy-and-agreements' },
]

function ReminderIcon({ kind }: { kind: ReminderKind }) {
  if (kind === 'payment') return <Clock3 size={17} aria-hidden="true" />
  if (kind === 'favorite') return <Check size={17} aria-hidden="true" />
  if (kind === 'recycle') return <ShieldCheck size={17} aria-hidden="true" />
  return <FileText size={17} aria-hidden="true" />
}

export function ReminderPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState(reminderFixtures)
  const hasUnread = items.some((item) => item.unread)
  const groups = useMemo(() => ['今天', '更早'].map((label) => ({ label, items: items.filter((item) => item.group === label) })), [items])

  const readAndOpen = (item: ReminderItem) => {
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry))
    navigate(item.route)
  }

  return <main className="reminder-d3-page">
    <header className="reminder-d3-header">
      <DesignPromptTrigger nodeId="reminders:main" />
      <PageHeader className="reminder-d3-topbar" title="提醒" left={<IconButton label="返回" onClick={() => navigate(-1)}><ArrowLeft size={20} aria-hidden="true" /></IconButton>} right={<Button variant="ghost" size="sm" disabled={!hasUnread} onClick={() => setItems((current) => current.map((item) => ({ ...item, unread: false })))}>全部已读</Button>} />
    </header>
    <div className="reminder-d3-scroll">
      {groups.map((group) => <section className="reminder-d3-group" key={group.label} aria-labelledby={`reminder-${group.label}`}>
        <Heading id={`reminder-${group.label}`} variant="group">{group.label}</Heading>
        <div>{group.items.map((item) => <button type="button" key={item.id} className={`reminder-d3-item ${item.kind}${item.unread ? ' unread' : ''}`} onClick={() => readAndOpen(item)}>
          <i><ReminderIcon kind={item.kind} /></i>
          <span><span><strong>{item.title}</strong><time>{item.time}</time></span><small>{item.detail}</small></span>
          {item.unread && <b aria-label="未读" />}
        </button>)}</div>
      </section>)}
    </div>
  </main>
}
