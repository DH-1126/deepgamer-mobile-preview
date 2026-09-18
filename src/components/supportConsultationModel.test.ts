import { describe, expect, it } from 'vitest'
import { buildProductConsultationRoute, buildSupportEntryRoute } from './supportConsultationModel'

describe('support consultation routes', () => {
  it('keeps each support entry explicit and game scoped', () => {
    expect(buildSupportEntryRoute('faq')).toBe('/im/support-mengmeng?scenario=faq&gameCode=wzry')
    expect(buildSupportEntryRoute('account', 'hpjy')).toBe('/im/support-mengmeng?scenario=account&gameCode=hpjy')
    expect(buildSupportEntryRoute('product')).toBe('/im/support-mengmeng?scenario=recommend&gameCode=wzry')
  })

  it('preserves the exact product and optional game for consultation', () => {
    expect(buildProductConsultationRoute('2114872829163482747', 'sjzxd')).toBe('/im/support-mengmeng?scenario=product&productId=2114872829163482747&gameCode=sjzxd')
  })
})
