import { useId } from 'react'
import type { Recycler } from '../types/sell'
import { Button, Heading, StatusBadge } from './ui'
import './recycler-card.css'

export type RecyclerCardProps = {
  recycler: Recycler
  onConsult: (recycler: Recycler) => void
}

/** Shared presentation only; selection, persistence and navigation belong to the caller. */
export function RecyclerCard({ recycler, onConsult }: RecyclerCardProps) {
  const titleId = useId()
  const online = recycler.availability === 'online'

  return <article className="dg-recycler-card" data-ui="RecyclerCard" aria-labelledby={titleId}>
    <header className="dg-recycler-card__header">
      <span className="dg-recycler-card__avatar" aria-hidden="true">{recycler.mark}</span>
      <div className="dg-recycler-card__identity">
        <Heading as="h2" variant="page" id={titleId}>{recycler.name}</Heading>
        <p>{online && recycler.averageResponseMinutes
          ? `平均 ${recycler.averageResponseMinutes} 分钟响应`
          : `服务时间 ${recycler.serviceTime}`}</p>
      </div>
      <StatusBadge tone={online ? 'success' : 'neutral'}>{online ? '接单中' : '休息中'}</StatusBadge>
    </header>
    <p className="dg-recycler-card__description">{recycler.description}</p>
    <footer className="dg-recycler-card__footer">
      <ul className="dg-recycler-card__tags" aria-label="服务特点">
        {recycler.tags.map(tag => <li key={tag}><StatusBadge>{tag}</StatusBadge></li>)}
      </ul>
      <Button size="md" variant={online ? 'primary' : 'outline'} disabled={!online}
        aria-label={`${online ? '免费咨询' : '暂不可咨询'}${recycler.name}`}
        onClick={() => { if (online) onConsult(recycler) }}>
        {online ? '免费咨询' : '暂不可咨询'}
      </Button>
    </footer>
  </article>
}
