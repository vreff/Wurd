import type { DeterministicPlugin } from '../../src/plugins.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Accordion plugin — deterministic.
 *
 * Usage:
 *   [plugin:accordion]
 *   Title 1 | Body text for section 1
 *   Title 2 | Body text for section 2
 *   Title 3 | Body text for section 3
 *   [/plugin]
 *
 * Each line is one accordion item: "Title | Body".
 * Uses Pretext's prepare/layout at runtime for height calculation.
 */

let accordionCounter = 0

function reset() {
  accordionCounter = 0
}

const plugin: DeterministicPlugin = {
  name: 'accordion',
  mode: 'deterministic',

  layoutHints: {
    spanKey: 'accordions',
    defaultSpan: 'column',
    marginTop: 16,
    marginBottom: 20,
  },

  assets: {
    runtimeModule: join(__dirname, 'runtime.ts'),
    css: `
    .accordion-stack {
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 14px;
      background: rgba(255,255,255,0.04);
      overflow: hidden;
    }
    .accordion-item + .accordion-item {
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    .accordion-toggle {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      width: 100%;
      padding: 16px 20px;
      border: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
      font-family: inherit;
    }
    .accordion-toggle:hover {
      background: rgba(255,255,255,0.03);
    }
    .accordion-title {
      display: block;
      font-size: 17px;
      font-weight: 600;
      line-height: 1.3;
      color: rgba(255,255,255,0.92);
    }
    .accordion-glyph {
      display: grid;
      place-items: center;
      width: 18px;
      height: 18px;
      color: var(--accent-color, #c9a84c);
    }
    .accordion-glyph::before {
      content: "";
      width: 0;
      height: 0;
      border-top: 5px solid transparent;
      border-bottom: 5px solid transparent;
      border-left: 7px solid currentColor;
    }
    .accordion-body {
      height: 0;
      overflow: clip;
    }
    .accordion-inner {
      padding: 0 20px 18px;
    }
    .accordion-copy {
      margin: 0;
      font-size: 16px;
      line-height: 26px;
      color: rgba(255,255,255,0.78);
    }
    `,
  },

  render(content: string, id: string): string {
    reset()
    const lines = content.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) return '<div class="plugin-error">Accordion: no items</div>'

    const items = lines.map((line, i) => {
      const pipeIdx = line.indexOf('|')
      if (pipeIdx === -1) {
        return { title: line.trim(), body: '' }
      }
      return {
        title: line.slice(0, pipeIdx).trim(),
        body: line.slice(pipeIdx + 1).trim(),
      }
    })

    const stackId = `${id}-stack`
    let html = `<div id="${stackId}" class="accordion-stack" aria-label="Accordion">`

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!
      const itemId = `${id}-item-${i}`
      html += `<article class="accordion-item" data-item-id="${itemId}">`
      html += `<button type="button" class="accordion-toggle" data-item-id="${itemId}" aria-expanded="false">`
      html += `<span class="accordion-title">${escapeHtml(item.title)}</span>`
      html += `<span class="accordion-glyph" aria-hidden="true"></span>`
      html += `</button>`
      html += `<div class="accordion-body"><div class="accordion-inner">`
      html += `<p class="accordion-copy">${escapeHtml(item.body)}</p>`
      html += `</div></div>`
      html += `</article>`
    }

    html += `</div>`
    return html
  },
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default plugin
