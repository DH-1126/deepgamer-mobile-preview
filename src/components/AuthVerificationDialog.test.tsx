import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { AuthVerificationDialog, type AuthVerificationIntent } from './AuthVerificationDialog'

function renderDialog(intent: AuthVerificationIntent) {
  return renderToStaticMarkup(<StaticRouter location="/login/password"><AuthVerificationDialog intent={intent} onClose={() => {}} onSuccess={() => {}} /></StaticRouter>)
}

describe('password login verification dialogs', () => {
  it('registers with the original password without showing it or a change-phone entry', () => {
    const html = renderDialog({ mode: 'register', phone: '13800138000', password: 'example2026' })
    expect(html).toContain('验证手机号')
    expect(html).toContain('当前手机号尚未注册')
    expect(html).toContain('验证通过后将自动注册登录并设置您已输入的密码')
    expect(html).toContain('138 **** 8000')
    expect(html).toContain('注册并登录')
    expect(html).not.toContain('example2026')
    expect(html).not.toContain('13800138000')
    expect(html).not.toContain('更换手机号')
    expect(html.match(/data-ui="TextField"/g)).toHaveLength(1)
    expect(html).toContain('maxLength="6"')
  })

  it('keeps reset inputs in the required order and uses shared form primitives', () => {
    const html = renderDialog({ mode: 'reset', phone: '18788660033', trigger: 'attempts' })
    expect(html).toContain('密码多次输入错误')
    expect(html).toContain('请设置新密码，并完成短信验证。')
    expect(html).toContain('确认重置')
    expect(html).not.toContain('前往修改密码')
    expect(html).not.toContain('更换手机号')
    expect(html.match(/data-ui="Dialog"/g)).toHaveLength(1)
    expect(html.match(/data-ui="TextField"/g)).toHaveLength(3)
    expect(html.match(/autoComplete="new-password"/g)).toHaveLength(2)
    expect(html.indexOf('aria-label="新密码"')).toBeLessThan(html.indexOf('aria-label="确认新密码"'))
    expect(html.indexOf('aria-label="确认新密码"')).toBeLessThan(html.indexOf('aria-label="验证码"'))
    expect(html).toContain('显示新密码')
    expect(html).toContain('显示确认新密码')
    expect(html).toContain('获取验证码')
    expect(html).toContain('联系客服')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
  })

  it('does not claim repeated failures for the direct forgot-password entry', () => {
    const html = renderDialog({ mode: 'reset', phone: '18788660033', trigger: 'manual' })
    expect(html).toContain('找回密码')
    expect(html).not.toContain('密码多次输入错误')
  })
})
