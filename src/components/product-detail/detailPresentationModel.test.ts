import { describe, expect, it } from 'vitest'
import { productDetailRepository } from '../../repository/productDetailRepository'
import { getDetailPresentation } from './detailPresentationModel'

const specimen = productDetailRepository.getById('1')!

describe('Draft5 product detail presentation', () => {
  it('applies the explicit reference content only to the local design specimen', () => {
    const view = getDetailPresentation(specimen)
    expect(view.specimen).toBe(true)
    expect(view.verified).toBe(true)
    expect(view.publishedAt).toBe('2026-08-03')
    expect(view.metrics.map(item => item.value)).toEqual(['王者50★', '108', '312'])
    expect(view.tradeInfo.find(item => item.id === 'realname')?.value).toBe('可二次实名')
    expect([...view.tradeInfo, ...view.extraInfo].map(item => item.id)).toEqual(['realname', 'binding', 'age', 'login', 'restriction', 'negotiable', 'inscription'])
  })

  it('uses the verified presentation without replacing linked goods with fixture values', () => {
    const view = getDetailPresentation(specimen, true)
    expect(view.specimen).toBe(false)
    expect(view.verified).toBe(true)
    expect(view.publishedAt).toBe('未提供')
    expect(view.priceDrop).toBe(0)
    expect(view.metrics).toEqual(specimen.metrics)
    expect(view.sellerDescription).toEqual(specimen.description)
    expect(view.tradeInfo.find(item => item.id === 'realname')?.value).toBe(specimen.realName)
  })

  it('preserves another game’s actual metrics while presenting all details as verified', () => {
    const delta = productDetailRepository.getById('SJ11DG001')!
    const view = getDetailPresentation(delta)
    expect(view.specimen).toBe(false)
    expect(view.verified).toBe(true)
    expect(view.verifiedAt).toBe('平台已核验')
    expect(view.metrics).toEqual(delta.metrics)
    expect(view.priceDrop).toBe(427)
    expect(view.verificationSummary[1].value).toBe('行动等级60')
    expect(view.tradeInfo.find(item => item.id === 'realname')?.value).toBe('已实名-不可改实名')
  })

  it('does not erase zero quantities or mutate the data record', () => {
    const record = { ...specimen, heroCount: 0, skinCount: 0, originalPrice: 100, price: 100 }
    const before = JSON.stringify(record)
    const view = getDetailPresentation(record)
    expect(view.metrics.map(item => item.value)).toEqual(['王者50★', '0', '0'])
    expect(view.priceDrop).toBe(0)
    expect(JSON.stringify(record)).toBe(before)
  })
})
