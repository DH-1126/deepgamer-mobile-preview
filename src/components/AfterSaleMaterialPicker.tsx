import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Image as ImageIcon, LoaderCircle, X } from 'lucide-react'
import { Heading } from './ui'
import { materialUploadSummary, validateAfterSaleMaterials, type MaterialUpload } from './afterSaleMaterialModel'

type Props = { names: string[]; onChange: (names: string[], error: string) => void; onStatusChange: (blocked: boolean) => void; error?: string; failurePreview?: boolean; disabled?: boolean }

export function AfterSaleMaterialPicker({ names, onChange, onStatusChange, error, failurePreview = false, disabled = false }: Props) {
  const [items, setItems] = useState<MaterialUpload[]>(() => failurePreview ? [{ id: 'preview-failure', name: '协商记录.png', status: 'failed' }] : names.map((name, index) => ({ id: `saved-${index}`, name, status: 'ready' })))
  const itemsRef = useRef(items)
  const callbacks = useRef({ onChange, onStatusChange })
  callbacks.current = { onChange, onStatusChange }
  const serial = useRef(0)
  const mounted = useRef(true)
  const readers = useRef(new Set<FileReader>())
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const publish = (next: MaterialUpload[], message = '') => {
    if (!mounted.current) return
    itemsRef.current = next; setItems(next)
    const summary = materialUploadSummary(next)
    callbacks.current.onChange(summary.names, message)
    callbacks.current.onStatusChange(summary.blocked)
  }
  useEffect(() => {
    mounted.current = true
    callbacks.current.onStatusChange(materialUploadSummary(itemsRef.current).blocked)
    return () => { mounted.current = false; readers.current.forEach(reader => reader.abort()); timers.current.forEach(clearTimeout) }
  }, [])
  const update = (id: string, values: Partial<MaterialUpload>) => publish(itemsRef.current.map(item => item.id === id ? { ...item, ...values } : item))
  const prepare = (item: MaterialUpload) => {
    update(item.id, { status: 'uploading' })
    const finish = (preview?: string) => {
      const timer = setTimeout(() => { timers.current.delete(timer); update(item.id, { status: navigator.onLine ? 'ready' : 'failed', preview }) }, 450)
      timers.current.add(timer)
    }
    if (!item.file) { finish(item.preview); return }
    const reader = new FileReader(); readers.current.add(reader)
    reader.onload = () => { readers.current.delete(reader); finish(typeof reader.result === 'string' ? reader.result : undefined) }
    reader.onerror = () => { readers.current.delete(reader); update(item.id, { status: 'failed' }) }
    reader.readAsDataURL(item.file)
  }
  const add = (files: File[]) => {
    if (!files.length || disabled) return
    const message = validateAfterSaleMaterials(files, itemsRef.current.length)
    if (message) { publish(itemsRef.current, message); return }
    const added: MaterialUpload[] = files.map(file => ({ id: `material-${++serial.current}`, name: file.name, file, status: 'uploading' }))
    publish([...itemsRef.current, ...added])
    added.forEach(prepare)
  }
  return <section className="aftersales-material-picker aftersales-material-picker--states">
    <header><Heading as="h2" variant="section">补充材料 <em>*</em></Heading><small>最多 6 张 · 单张 ≤10MB</small></header>
    <div className="aftersales-material-grid">{items.map(item => <div key={item.id} className={`aftersales-material-tile status-${item.status}`}>
      {item.status === 'failed' ? <button type="button" className="aftersales-material-retry" disabled={disabled} onClick={() => prepare(item)} aria-label={`重试上传 ${item.name}`}><AlertCircle size={17} /><span>上传失败</span><small>点击重试</small></button> : <>{item.preview ? <img src={item.preview} alt={item.name} /> : <ImageIcon size={20} aria-label={item.name} />}{item.status === 'uploading' && <span className="aftersales-material-progress" role="status"><LoaderCircle size={18} />上传中</span>}</>}
      <button type="button" className="aftersales-material-remove" disabled={disabled} onClick={() => publish(itemsRef.current.filter(entry => entry.id !== item.id))} aria-label={`删除材料 ${item.name}`}><X size={12} /></button>
    </div>)}{items.length < 6 && <label className="aftersales-material-add" aria-disabled={disabled}><b>＋</b><small>上传</small><input type="file" aria-label="上传补充材料" accept="image/jpeg,image/png" multiple disabled={disabled} onChange={event => { add(Array.from(event.target.files ?? [])); event.currentTarget.value = '' }} /></label>}</div>
    {items.some(item => item.status === 'failed') && <p className="aftersales-material-hint" role="alert">有材料上传失败，请重试或删除后重新上传。</p>}
    {error && <em role="alert">{error}</em>}
  </section>
}
