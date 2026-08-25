import { describe, expect, it } from 'vitest'
import { getContractSubmitIssue } from './fulfillmentModel'

describe('fulfillment contract model', () => {
  it('requires both a signature and explicit agreement', () => {
    expect(getContractSubmitIssue('', false)).toBe('请先完成签名')
    expect(getContractSubmitIssue('李明', false)).toBe('请先阅读并同意协议')
    expect(getContractSubmitIssue('李明', true)).toBe('')
  })
})
