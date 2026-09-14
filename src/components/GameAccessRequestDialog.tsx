import { useId, useState, type FormEvent } from 'react'
import { Button, Dialog, TextField } from './ui'
import { validateGameAccessRequest } from './sellModel'
import type { GameAccessRequestInput } from '../types/sell'
import './game-access-request-dialog.css'

type Props = { onClose: () => void; onSubmit: (request: GameAccessRequestInput) => boolean }

export function GameAccessRequestDialog({ onClose, onSubmit }: Props) {
  const formId = useId()
  const [values, setValues] = useState<GameAccessRequestInput>({ gameName: '', manufacturer: '' })
  const [errors, setErrors] = useState<ReturnType<typeof validateGameAccessRequest>>({})
  const [submitError, setSubmitError] = useState('')
  const update = (field: keyof GameAccessRequestInput, value: string) => {
    setValues(current => ({ ...current, [field]: value }))
    setErrors(current => ({ ...current, [field]: undefined }))
    setSubmitError('')
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = validateGameAccessRequest(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    if (!onSubmit({ gameName: values.gameName.trim(), manufacturer: values.manufacturer.trim() })) setSubmitError('提交失败，内容已保留，请重试')
  }
  return <Dialog open title="接入更多游戏" onClose={onClose} actions={<>
    <Button variant="outline" onClick={onClose}>取消</Button>
    <Button type="submit" form={formId}>提交</Button>
  </>}>
    <form id={formId} className="game-access-request-form" onSubmit={submit} noValidate>
      <p>告诉我们你希望接入的游戏</p>
      <TextField label="游戏名称" name="gameName" placeholder="请输入游戏名称" value={values.gameName} onChange={event => update('gameName', event.target.value)} error={errors.gameName} maxLength={40} required autoComplete="off" />
      <TextField label="游戏厂商" name="manufacturer" placeholder="请输入游戏厂商" value={values.manufacturer} onChange={event => update('manufacturer', event.target.value)} error={errors.manufacturer} maxLength={60} required autoComplete="off" />
      {submitError && <p className="game-access-request-error" role="alert">{submitError}</p>}
    </form>
  </Dialog>
}
