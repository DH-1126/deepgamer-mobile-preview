import { Share2 } from 'lucide-react'
import { assetPath } from '../assetPath'
import { IconButton, StatusBar } from '../ui'
import { SellerSummary } from './SellerSummary'

type Props = {
  compact: boolean
  price: number
  gameName: string
  sellerSummary: string
  onBack: () => void
  onShare: () => void
  onOpenSeller: () => void
}

/** Keep navigation unchanged; the pinned summary occupies its own row below it. */
export function ProductDetailHeader({ compact, price, gameName, sellerSummary, onBack, onShare, onOpenSeller }: Props) {
  return <><header className="detail-header">
    <StatusBar className="detail-status" />
    <div className="detail-titlebar">
      <IconButton label="返回" onClick={onBack}><img src={assetPath('assets/product-detail-draft5/back.svg')} alt="" width={20} height={20} /></IconButton>
      <div aria-hidden="true" />
      <IconButton label="分享商品" onClick={onShare}><Share2 size={20} aria-hidden="true" /></IconButton>
    </div>
  </header>
    {compact && <section className="detail-pinned-summary" aria-label="顶部商品摘要">
      <div className="detail-header-identity"><strong>¥{price.toLocaleString('zh-CN')}</strong><span>{gameName}</span></div>
      <SellerSummary text={sellerSummary} onOpen={onOpenSeller} label="查看顶部卖家一句话" />
    </section>}
  </>
}
