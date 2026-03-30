import MarkdownIt from 'markdown-it'
import type { Plugin } from './plugins'
import type { StyleConfig } from './template'

export interface ParsedToken {
  type: 'html'
  content: string
}

export interface PluginToken {
  type: 'plugin'
  pluginName: string
  content: string
  /** Raw markdown surrounding this plugin tag (2 paragraphs before + after) */
  context?: string
}

export interface BlockStartToken {
  type: 'block-start'
}

export interface BlockEndToken {
  type: 'block-end'
}

export type Token = ParsedToken | PluginToken | BlockStartToken | BlockEndToken

/**
 * Extract frontmatter style config from the beginning of a markdown document.
 * Supports a simple key: value format between --- delimiters:
 *
 *   ---
 *   bodyFont: 20px Georgia, serif
 *   accentColor: #d4a74a
 *   dropCap: false
 *   maxContentWidth: 800
 *   ---
 *
 * Returns the parsed style config and the markdown with frontmatter stripped.
 */
export function extractFrontmatter(markdown: string): { style: StyleConfig; markdown: string } {
  const style: StyleConfig = {}
  const trimmed = markdown.trimStart()
  if (!trimmed.startsWith('---')) return { style, markdown }

  const endIdx = trimmed.indexOf('\n---', 3)
  if (endIdx === -1) return { style, markdown }

  const frontmatterBlock = trimmed.slice(3, endIdx).trim()
  const remaining = trimmed.slice(endIdx + 4).trimStart()

  for (const line of frontmatterBlock.split('\n')) {
    const trimLine = line.trim()
    if (!trimLine || trimLine.startsWith('#')) continue
    const colonIdx = trimLine.indexOf(':')
    if (colonIdx === -1) continue
    const key = trimLine.slice(0, colonIdx).trim()
    let val: string | number | boolean = trimLine.slice(colonIdx + 1).trim()

    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }

    // Parse booleans and numbers
    if (val === 'true') val = true
    else if (val === 'false') val = false
    else if (/^\d+(\.\d+)?$/.test(String(val))) val = Number(val)

    style[key] = val
  }

  return { style, markdown: remaining }
}

// Content group uses negative lookahead to avoid matching across nested plugin tags
// Supports both [plugin:name] and \[plugin:name\] (Markdown-escaped brackets)
const PLUGIN_REGEX = /\\?\[plugin:([a-zA-Z0-9_-]+)\\?\]((?:(?!\\?\[plugin:|\\?\[\/plugin\\?\])[\s\S])*?)\\?\[\/plugin\\?\]/g

// Block-level plugins get their own token; inline plugins are pre-rendered into the markdown.
// A plugin tag is "block-level" only if it starts at column 0 (no indentation).
// Indented tags (inside lists, blockquotes) are treated as inline so they stay within their context.
const BLOCK_PLUGIN_REGEX = /^\\?\[plugin:([a-zA-Z0-9_-]+)\\?\]((?:(?!\\?\[plugin:|\\?\[\/plugin\\?\])[\s\S])*?)\\?\[\/plugin\\?\][ \t]*$/gm

// Non-global version for testing if text contains a plugin tag (no lastIndex side effects)
const PLUGIN_TEST = /\\?\[plugin:([a-zA-Z0-9_-]+)\\?\]((?:(?!\\?\[plugin:|\\?\[\/plugin\\?\])[\s\S])*?)\\?\[\/plugin\\?\]/

/**
 * Extract N paragraphs before and after a position in the markdown string.
 * A "paragraph" is a non-empty block of text separated by blank lines.
 */
function extractSurroundingContext(markdown: string, startIdx: number, endIdx: number, count = 2): string {
  // Split into paragraphs by double newline
  const paragraphs: { text: string; start: number; end: number }[] = []
  const paraRegex = /[^\n]+(\n(?!\n)[^\n]*)*/g
  let m: RegExpExecArray | null
  while ((m = paraRegex.exec(markdown)) !== null) {
    paragraphs.push({ text: m[0].trim(), start: m.index, end: m.index + m[0].length })
  }

  const before: string[] = []
  const after: string[] = []

  for (const p of paragraphs) {
    if (p.end <= startIdx && !PLUGIN_TEST.test(p.text)) {
      before.push(p.text)
      if (before.length > count) before.shift()
    }
  }
  for (const p of paragraphs) {
    if (p.start >= endIdx) {
      if (!PLUGIN_TEST.test(p.text)) {
        after.push(p.text)
        if (after.length >= count) break
      }
    }
  }

  const parts: string[] = []
  if (before.length) parts.push('BEFORE:\n' + before.join('\n\n'))
  if (after.length) parts.push('AFTER:\n' + after.join('\n\n'))
  return parts.join('\n\n')
}

const BLOCK_START_SENTINEL = '\x00BLOCK_START\x00'
const BLOCK_END_SENTINEL = '\x00BLOCK_END\x00'

export function parse(markdown: string, plugins: Map<string, Plugin>): Token[] {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true })
  const tokens: Token[] = []
  let inlineCounter = 0

  // Preprocess [block]/[/block] markers to sentinels before any other processing
  const withBlockSentinels = markdown
    .replace(/^\[block\]\s*$/gm, BLOCK_START_SENTINEL)
    .replace(/^\[\/block\]\s*$/gm, BLOCK_END_SENTINEL)

  // Phase 1: Pre-render DETERMINISTIC inline plugin tags into HTML.
  // LLM plugins at inline level are left as-is (they'll be handled async later).
  // We first identify block-level tags (on their own line) so we don't touch those.
  const blockRanges: { start: number; end: number }[] = []
  BLOCK_PLUGIN_REGEX.lastIndex = 0
  let bm: RegExpExecArray | null
  while ((bm = BLOCK_PLUGIN_REGEX.exec(withBlockSentinels)) !== null) {
    blockRanges.push({ start: bm.index, end: bm.index + bm[0].length })
  }

  function isInBlockRange(offset: number): boolean {
    return blockRanges.some(r => offset >= r.start && offset < r.end)
  }

  // Replace inline deterministic plugin tags with their rendered HTML
  const preprocessed = withBlockSentinels.replace(PLUGIN_REGEX, (match, name: string, content: string, offset: number) => {
    if (isInBlockRange(offset)) return match // leave block tags alone
    const plugin = plugins.get(name)
    if (!plugin) return match
    if (plugin.mode !== 'deterministic') return match // leave LLM plugins for async phase
    const id = `plugin-${name}-inline-${inlineCounter++}`
    return plugin.render(content, id)
  })

  // Phase 2: Split on block-level plugin tags. The remaining text is markdown with
  // inline plugins already rendered to HTML.
  BLOCK_PLUGIN_REGEX.lastIndex = 0
  const parts = preprocessed.split(BLOCK_PLUGIN_REGEX)

  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      const text = parts[i]!
      // Split on block sentinels to emit block-start/block-end tokens
      const SENTINEL_RE = /(\x00BLOCK_START\x00|\x00BLOCK_END\x00)/
      const segments = text.split(SENTINEL_RE)
      for (const seg of segments) {
        if (seg === BLOCK_START_SENTINEL) {
          tokens.push({ type: 'block-start' })
        } else if (seg === BLOCK_END_SENTINEL) {
          tokens.push({ type: 'block-end' })
        } else if (seg.trim().length > 0) {
          // Strip {#id} tags from headings before rendering, inject as id attributes after
          const idMap = new Map<string, string>()
          const processed = seg.replace(/^(#{1,6}\s+.+?)\s*\{#([\w-]+)\}\s*$/gm, (_match, heading, id) => {
            const headingText = heading.replace(/^#{1,6}\s+/, '').trim()
            idMap.set(headingText, id)
            return heading
          })
          let html = md.render(processed)
          // Inject id attributes on heading elements
          for (const [text, id] of idMap) {
            const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            html = html.replace(new RegExp(`(<h[1-6])>(${escaped})`), `$1 id="${id}">$2`)
          }
          tokens.push({ type: 'html', content: html })
        }
      }
    } else if (i % 3 === 1) {
      const name = parts[i]!
      const content = parts[i + 1] || ''
      // Find this tag's position in the original markdown for context extraction
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const tagPattern = new RegExp(
        `\\\\?\\[plugin:${escapedName}\\\\?\\]`
      )
      const tagMatch = tagPattern.exec(markdown)
      const context = tagMatch
        ? extractSurroundingContext(markdown, tagMatch.index, tagMatch.index + content.length + name.length + 20)
        : undefined
      tokens.push({ type: 'plugin', pluginName: name, content, context })
    }
  }

  return tokens
}
