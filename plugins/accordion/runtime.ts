/**
 * Accordion browser runtime — uses Pretext's prepare/layout to calculate
 * section heights without DOM measurement.
 *
 * This module is registered via PluginAssets.runtimeModule and gets
 * bundled into the page automatically when the accordion plugin is loaded.
 */
import { prepare, layout, type PreparedText } from '@chenglou/pretext'

interface AccordionState {
  openItemId: string | null
  preparedCache: Map<string, PreparedText>
  cachedFont: string
}

const accordions = new Map<string, AccordionState>()

export function init(): void {
  const stacks = document.querySelectorAll<HTMLElement>('.accordion-stack')
  for (const stack of stacks) {
    const id = stack.id
    if (!id || accordions.has(id)) continue

    const state: AccordionState = {
      openItemId: null,
      preparedCache: new Map(),
      cachedFont: '',
    }
    accordions.set(id, state)

    stack.addEventListener('click', (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const toggle = target.closest<HTMLButtonElement>('.accordion-toggle')
      if (!toggle) return
      const itemId = toggle.dataset['itemId']
      if (!itemId) return

      state.openItemId = state.openItemId === itemId ? null : itemId
      renderAccordion(stack, state)
      // Trigger full Pretext relayout so absolute positions are recalculated
      document.dispatchEvent(new CustomEvent('pretext:relayout'))
    })

    renderAccordion(stack, state)
  }

  window.addEventListener('resize', () => {
    for (const [id, state] of accordions) {
      const stack = document.getElementById(id)
      if (stack) renderAccordion(stack, state)
    }
  })
}

function parsePx(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function getFontString(styles: CSSStyleDeclaration): string {
  return styles.font.length > 0
    ? styles.font
    : `${styles.fontStyle} ${styles.fontVariant} ${styles.fontWeight} ${styles.fontSize} / ${styles.lineHeight} ${styles.fontFamily}`
}

function renderAccordion(stack: HTMLElement, state: AccordionState): void {
  const items = stack.querySelectorAll<HTMLElement>('.accordion-item')
  if (items.length === 0) return

  const firstCopy = items[0]!.querySelector<HTMLElement>('.accordion-copy')
  const firstInner = items[0]!.querySelector<HTMLElement>('.accordion-inner')
  if (!firstCopy || !firstInner) return

  const copyStyles = getComputedStyle(firstCopy)
  const innerStyles = getComputedStyle(firstInner)
  const font = getFontString(copyStyles)
  const lineHeight = parsePx(copyStyles.lineHeight)
  const contentWidth = firstCopy.getBoundingClientRect().width
  const paddingY = parsePx(innerStyles.paddingTop) + parsePx(innerStyles.paddingBottom)

  if (state.cachedFont !== font) {
    state.cachedFont = font
    state.preparedCache.clear()
  }

  for (const item of items) {
    const itemId = item.dataset['itemId'] || ''
    const copy = item.querySelector<HTMLElement>('.accordion-copy')
    const body = item.querySelector<HTMLElement>('.accordion-body')
    const glyph = item.querySelector<HTMLElement>('.accordion-glyph')
    const toggle = item.querySelector<HTMLButtonElement>('.accordion-toggle')
    if (!copy || !body || !glyph || !toggle) continue

    const text = copy.textContent || ''

    if (!state.preparedCache.has(itemId)) {
      state.preparedCache.set(itemId, prepare(text, font))
    }
    const prepared = state.preparedCache.get(itemId)!
    const metrics = layout(prepared, contentWidth, lineHeight)
    const panelHeight = Math.ceil(metrics.height + paddingY)

    const expanded = state.openItemId === itemId
    body.style.height = expanded ? `${panelHeight}px` : '0px'
    glyph.style.transform = expanded ? 'rotate(90deg)' : 'rotate(0deg)'
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false')
  }
}
