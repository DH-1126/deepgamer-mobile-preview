import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { useDetailSections } from './useDetailSections'

const navigation = vi.hoisted(() => ({ setParams: vi.fn() }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useSearchParams: () => [actual.useSearchParams()[0], navigation.setParams] }
})

function setup(query = '') {
  let hook!: ReturnType<typeof useDetailSections>
  function Probe() { hook = useDetailSections('1'); return null }
  renderToStaticMarkup(<StaticRouter location={'/goods/1' + query}><Probe /></StaticRouter>)
  const container = {
    scrollTop: 1000, scrollHeight: 2200, clientHeight: 640,
    getBoundingClientRect: () => ({ top: 84 }),
    querySelector: (selector: string) => selector === '.detail-tabs'
      ? { getBoundingClientRect: () => ({ height: 38 }) }
      : { getBoundingClientRect: () => ({ top: 84 + 560 - container.scrollTop }) },
    scrollTo: vi.fn(({ top }: { top: number }) => { container.scrollTop = top }),
  }
  Object.assign(hook.scrollRef, { current: container })
  return { hook, container }
}

describe('independent detail panel navigation', () => {
  it('selects assets by default and respects direct tab links', () => {
    expect(setup().hook.activeSection).toBe('assets')
    expect(setup('?tab=description').hook.activeSection).toBe('description')
    expect(setup('?tab=guarantee').hook.activeSection).toBe('guarantee')
  })
  it('scrolling does not navigate or select a different panel', () => {
    navigation.setParams.mockClear()
    const { hook, container } = setup()
    hook.onScroll()
    expect(navigation.setParams).not.toHaveBeenCalled()
    expect(container.scrollTo).not.toHaveBeenCalled()
    expect(hook.activeSection).toBe('assets')
  })
  it('preserves other query parameters and avoids adding history per tab click', () => {
    navigation.setParams.mockClear()
    const { hook } = setup('?from=search')
    hook.goToSection('description')
    const [update, options] = navigation.setParams.mock.calls[0]
    expect(update(new URLSearchParams('from=search')).toString()).toBe('from=search&tab=description')
    expect(options).toEqual({ replace: true, preventScrollReset: true })
  })
  it('returns to the asset panel top beneath the sticky tabs', () => {
    const { hook, container } = setup()
    hook.returnToTabTop()
    expect(container.scrollTo).toHaveBeenLastCalledWith({ top: 522, behavior: 'auto' })
    expect(container.scrollTop).toBeGreaterThan(0)
  })
})
