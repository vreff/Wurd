import katex from 'katex'
import type { DeterministicPlugin } from '../../src/plugins.js'

/**
 * Math plugin — deterministic KaTeX rendering (no LLM needed).
 * Math rendering is exact and doesn't benefit from AI generation.
 *
 * Inline: [plugin:math]x^2 + 1[/plugin]
 * Block:  [plugin:math]\[x^2 + 1\][/plugin]
 */
const mathPlugin: DeterministicPlugin = {
  name: 'math',
  mode: 'deterministic',

  layoutHints: {
    spanKey: 'math',
    defaultSpan: 'column',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },

  assets: {
    css: `
    .math-block {
      text-align: center;
      padding: 12px 0;
      overflow-x: auto;
      max-width: 100%;
    }
    .math-inline { display: inline; }
    .katex { color: rgba(255,255,255,0.92); }
    `,
    headElements: [
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" integrity="sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+" crossorigin="anonymous">',
    ],
  },

  render(content: string, id: string): string {
    // Un-escape doubled backslashes from markdown formatters:
    // \\cdot → \cdot, \\times → \times, \\frac → \frac, etc.
    // Preserves intentional \\ (line breaks) since those aren't followed by [a-zA-Z]
    const unescaped = content.replace(/\\\\([a-zA-Z])/g, '\\$1')
    const trimmed = unescaped.trim()

    // Detect block vs inline: inline IDs (from parser) always render inline;
    // otherwise block if starts with \[ or contains newlines
    const forceInline = id.includes('-inline-')
    const isBlock = !forceInline && (trimmed.startsWith('\\[') || trimmed.includes('\n') || trimmed.startsWith('$$'))

    // Strip delimiters if present
    let tex = trimmed
    if (tex.startsWith('\\[') && tex.endsWith('\\]')) {
      tex = tex.slice(2, -2).trim()
    } else if (tex.startsWith('$$') && tex.endsWith('$$')) {
      tex = tex.slice(2, -2).trim()
    } else if (tex.startsWith('\\(') && tex.endsWith('\\)')) {
      tex = tex.slice(2, -2).trim()
    } else if (tex.startsWith('$') && tex.endsWith('$')) {
      tex = tex.slice(1, -1).trim()
    }

    const html = katex.renderToString(tex, {
      displayMode: isBlock,
      throwOnError: false,
      trust: false,
      strict: false,
    })

    if (isBlock) {
      return `<div id="${id}" class="math-block">${html}</div>`
    }
    return `<span id="${id}" class="math-inline">${html}</span>`
  },
}

export default mathPlugin
