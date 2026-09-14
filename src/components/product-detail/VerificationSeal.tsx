import { assetPath } from '../assetPath'
import './verification-seal.css'

export type VerificationSealProps = { watermark?: boolean; decorative?: boolean; className?: string }
/** Visual verification result only; the caller is responsible for the verified business state. */
export function VerificationSeal({ watermark = false, decorative = false, className = '' }: VerificationSealProps) {
  return <img data-ui="VerificationSeal" className={`dg-verification-seal${watermark ? ' dg-verification-seal--watermark' : ''} ${className}`}
    src={assetPath('assets/product-detail-draft5/verification-seal-v2.png')} alt={decorative ? '' : '验号通过'}
    width={128} height={128} draggable={false} />
}
