import { describe, expect, it } from 'vitest'

const pages = import.meta.glob<string>(['../../pages/*.tsx', '!../../pages/*.test.tsx'], { eager: true, query: '?raw', import: 'default' })

describe('page-level component conventions', () => {
  it('uses Heading for ordinary page and block titles, with an explicit legal-document exception', () => {
    expect(Object.keys(pages)).toContain('../../pages/HomePage.tsx')
    for (const [file, source] of Object.entries(pages)) {
      const nativeHeadings = source.match(/<h[123](?:\s[^>]*|)>[\s\S]*?<\/h[123]>/g) ?? []
      if (file.endsWith('FulfillmentContractPage.tsx')) {
        expect(nativeHeadings).toEqual(['<h3>一 · 交易主体</h3>', '<h3>二 · 回收价款</h3>', '<h3>三 · 出让方承诺</h3>', '<h3>四 · 违约与争议</h3>'])
      } else expect(nativeHeadings, `${file} 的普通标题应引用 Heading`).toEqual([])
    }
  })

  it('uses shared native-select and multiline fields except dedicated chat composers', () => {
    for (const [file, source] of Object.entries(pages)) {
      expect(source, `${file} 的表单下拉应使用 SelectField`).not.toMatch(/<select[\s>]/)
      if (!['GroupChatPage.tsx', 'SupportChatPage.tsx'].some(name => file.endsWith(name))) {
        expect(source, `${file} 的说明输入应使用 TextAreaField`).not.toMatch(/<textarea[\s>]/)
      }
    }
  })
})
