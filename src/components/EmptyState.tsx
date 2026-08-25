import { SearchX } from 'lucide-react'

export function EmptyState({ onReset }: { onReset?: () => void }) {
  return (
    <section className="empty-state" aria-live="polite">
      <span><SearchX size={36} /></span>
      <h2>没有找到合适的账号</h2>
      <p>换个关键词或放宽筛选条件试试</p>
      {onReset && <button type="button" onClick={onReset}>清空筛选</button>}
    </section>
  )
}
