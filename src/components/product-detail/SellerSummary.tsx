import { forwardRef } from 'react'
import { ChevronRight } from 'lucide-react'
import './SellerSummary.css'

export type SellerSummaryProps = {
  text: string
  onOpen: () => void
  maxLines?: 1 | 2
  className?: string
  label?: string
}

export const SellerSummary = forwardRef<HTMLButtonElement, SellerSummaryProps>(function SellerSummary({
  text, onOpen, maxLines = 1, className = '', label = '查看卖家一句话',
}, ref) {
  return <button ref={ref} className={['detail-header-seller', maxLines === 2 ? 'detail-header-seller--two-lines' : '', className].filter(Boolean).join(' ')} type="button" onClick={onOpen} aria-label={label} aria-haspopup="dialog" data-ui="SellerSummary">
    <span className="detail-header-seller-label">卖家一句话</span>
    <span className="detail-header-seller-text">{text.trim() || '卖家暂未补充描述'}</span>
    <ChevronRight size={12} aria-hidden="true" />
  </button>
})
