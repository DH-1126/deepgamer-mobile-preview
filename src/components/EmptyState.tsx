import { SearchX } from 'lucide-react'
import { Button, EmptyStateView } from './ui'

export function EmptyState({ onReset }: { onReset?: () => void }) {
  return <EmptyStateView
    className="catalog-d3-empty-state"
    icon={<SearchX size={36} aria-hidden="true" />}
    title="没有找到合适的账号"
    description="换个关键词或放宽筛选条件试试"
    action={onReset ? <Button size="md" shape="pill" onClick={onReset}>清空筛选</Button> : undefined}
  />
}
