import { describe, expect, it } from 'vitest'
import { getLinkedProfileSellerState, getProfileSellerRoute, nextProfileSellerState, parseProfileSellerState } from './profileSellerModel'

describe('profile seller card model', () => {
  it('cycles through every local preview state including rejected', () => {
    expect(nextProfileSellerState('buyer')).toBe('signing')
    expect(nextProfileSellerState('rejected')).toBe('seller')
    expect(nextProfileSellerState('seller')).toBe('buyer')
    expect(parseProfileSellerState('unexpected')).toBe('buyer')
  })

  it('targets existing seller-center scenarios without overriding linked data', () => {
    expect(getProfileSellerRoute('buyer')).toBe('/seller/center?scenario=buyer')
    expect(getProfileSellerRoute('signing')).toBe('/seller/center?scenario=approved')
    expect(getProfileSellerRoute('review')).toBe('/seller/center?scenario=review')
    expect(getProfileSellerRoute('rejected')).toBe('/seller/center?scenario=rejected')
    expect(getProfileSellerRoute('seller')).toBe('/seller/center?scenario=complete')
    expect(getProfileSellerRoute('seller', true)).toBe('/seller/center')
  })

  it('maps linked seller authority without treating rejection as review', () => {
    expect(getLinkedProfileSellerState('PENDING')).toBe('review')
    expect(getLinkedProfileSellerState('REJECTED')).toBe('rejected')
    expect(getLinkedProfileSellerState('APPROVED', 'UNSIGNED')).toBe('signing')
    expect(getLinkedProfileSellerState('APPROVED', 'SIGNED')).toBe('seller')
  })
})
