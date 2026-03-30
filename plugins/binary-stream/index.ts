import type { DeterministicPlugin } from '../../src/plugins.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

let counter = 0

const plugin: DeterministicPlugin = {
  name: 'binary-stream',
  mode: 'deterministic',

  layoutHints: {
    spanKey: 'binaryStream',
    defaultSpan: 'column',
    marginTop: 0,
    marginBottom: 0,
  },

  assets: {
    runtimeModule: join(__dirname, 'runtime.ts'),
    css: `
    .binary-stream-container {
      position: relative;
      overflow: hidden;
      background: transparent;
      font-family: Georgia, Palatino, "Times New Roman", serif;
    }
    .binary-stream-container .bs-row {
      white-space: pre;
      overflow: hidden;
      margin: 0;
      padding: 0;
    }
    .binary-stream-container .w4 { font-weight: 400; }
    .binary-stream-container .w7 { font-weight: 700; }
    `,
  },

  render(content: string, id: string): string {
    // Parse simple key: value pairs from the content
    const CONFIG_KEYS = new Set(['cols', 'rows', 'fontSize', 'lineHeight', 'opacity', 'glowRadius', 'dimColor', 'litColor'])
    const config: Record<string, string> = {}
    const styles: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([\w-]+)\s*:\s*(.+)$/)
      if (!m) continue
      const key = m[1]!
      const val = m[2]!.trim()
      // camelCase keys go to config, everything else is CSS
      if (CONFIG_KEYS.has(key)) {
        config[key] = val
      } else {
        styles[key] = val
      }
    }
    const encoded = typeof Buffer !== 'undefined'
      ? Buffer.from(JSON.stringify(config)).toString('base64')
      : btoa(JSON.stringify(config))
    const styleAttr = Object.keys(styles).length > 0
      ? ` style="${Object.entries(styles).map(([k, v]) => `${k}:${v}`).join(';')}"`
      : ''
    return `<div id="binary-stream-${counter++}" class="binary-stream-container"${styleAttr} data-config="${encoded}"></div>`
  },
}

export default plugin
