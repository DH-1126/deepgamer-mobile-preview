import { describe, expect, it } from 'vitest'
import { materialUploadSummary, validateAfterSaleMaterials } from './afterSaleMaterialModel'

describe('aftersale material readiness', () => {
  it('blocks submission while any material is pending or failed', () => {
    expect(materialUploadSummary([{ id:'1', name:'a.png', status:'ready' }, { id:'2', name:'b.png', status:'failed' }])).toEqual({ names:['a.png'], blocked:true })
    expect(materialUploadSummary([{ id:'1', name:'a.png', status:'uploading' }])).toEqual({ names:[], blocked:true })
    expect(materialUploadSummary([{ id:'1', name:'a.png', status:'ready' }])).toEqual({ names:['a.png'], blocked:false })
  })
  it('rejects excess files rather than silently dropping them', () => {
    expect(validateAfterSaleMaterials([{ type:'image/png', size:100 }], 6)).toContain('最多上传 6 张')
    expect(validateAfterSaleMaterials([{ type:'image/gif', size:100 }], 0)).toContain('JPG、PNG')
    expect(validateAfterSaleMaterials([{ type:'image/jpeg', size:10*1024*1024+1 }], 0)).toContain('10MB')
    expect(validateAfterSaleMaterials([{ type:'image/jpeg', size:10*1024*1024 }], 5)).toBe('')
  })
})
