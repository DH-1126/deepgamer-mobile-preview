import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('restored purchase mounted interactions', () => {
  it('drives package selection and UNKNOWN recovery on real mounted React views', () => {
    const output = execFileSync(process.execPath, ['scripts/test-restored-purchase-pages.mjs'], { cwd: process.cwd(), encoding: 'utf8' })
    expect(JSON.parse(output.trim().split('\n').at(-1))).toEqual({ cases: 3, assertions: 18 })
  })
})
