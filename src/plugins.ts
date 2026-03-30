import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { callLLM, isLLMConfigured } from './llm.js'

/**
 * Layout hints — each plugin declares how its output should behave in
 * multi-column layouts. The layout engine reads these generically from
 * data-layout-* attributes instead of hard-coding per-type branches.
 */
export interface LayoutHints {
  /** columnSpan key name used in the frontmatter columnSpan list (e.g. 'graphs', 'tables', 'math') */
  spanKey: string
  /** Default column-span behavior when not overridden by frontmatter: 'all' or 'column' */
  defaultSpan: 'all' | 'column'
  /** Margin above the element in px */
  marginTop?: number
  /** Margin below the element in px */
  marginBottom?: number
  /** CSS text-align value */
  textAlign?: string
}

/**
 * Plugin-owned assets injected into the final HTML.
 * Moves styling out of the central renderer into each plugin.
 */
export interface PluginAssets {
  /** CSS rules to inject into the page <style> block */
  css?: string
  /** Raw HTML elements for <head> (e.g. CDN links) */
  headElements?: string[]
  /** Absolute path to a browser-side TS module that exports `init(): void` */
  runtimeModule?: string
}

/** A plugin that renders content deterministically (no LLM needed) */
export interface DeterministicPlugin {
  name: string
  mode: 'deterministic'
  render: (content: string, id: string) => string
  /** Layout hints for multi-column behavior */
  layoutHints?: LayoutHints
  /** Plugin-owned CSS and head elements */
  assets?: PluginAssets
  /** Optional: called after all tokens are resolved. Returns HTML to append (e.g. references section). */
  finalize?: () => string | null
  /** Layout hints for the finalize() output (may differ from inline render hints) */
  finalizeLayoutHints?: LayoutHints
}

/** A plugin that uses an LLM to generate content from a prompt */
export interface LLMPlugin {
  name: string
  mode: 'llm'
  /** System prompt describing the LLM's role and output format */
  systemPrompt: string
  /** Style guidelines the user can customize */
  guidelines: string
  /** Extract usable HTML/SVG from the raw LLM response */
  extractContent: (response: string) => string
  /** Layout hints for multi-column behavior */
  layoutHints?: LayoutHints
  /** Plugin-owned CSS and head elements */
  assets?: PluginAssets
}

/** Parsed plugin content with optional subtitle and surrounding context */
export interface PluginInput {
  /** The raw content after subtitle extraction */
  content: string
  /** User-specified subtitle/caption (from "subtitle: ..." line) */
  subtitle?: string
  /** Surrounding paragraphs from the source document for context */
  context?: string
}

export type Plugin = DeterministicPlugin | LLMPlugin

export async function loadPlugins(pluginsDir: string): Promise<Map<string, Plugin>> {
  const plugins = new Map<string, Plugin>()

  let entries: string[]
  try {
    entries = await readdir(pluginsDir)
  } catch {
    console.warn(`Plugins directory not found: ${pluginsDir}`)
    return plugins
  }

  for (const entry of entries) {
    if (entry.startsWith('_')) continue
    const fullPath = join(pluginsDir, entry)
    const info = await stat(fullPath)

    let modulePath: string | null = null
    if (info.isDirectory()) {
      // Look for index.ts / index.js in subdirectory
      const indexTs = join(fullPath, 'index.ts')
      const indexJs = join(fullPath, 'index.js')
      try { await stat(indexTs); modulePath = indexTs } catch {
        try { await stat(indexJs); modulePath = indexJs } catch { continue }
      }
    } else if (entry.endsWith('.ts') || entry.endsWith('.js')) {
      // Skip runtime files (they're imported by their plugin, not standalone)
      if (entry.includes('-runtime')) continue
      modulePath = fullPath
    }

    if (!modulePath) continue
    const mod = await import(pathToFileURL(modulePath).href)

    if (mod.default && typeof mod.default === 'object' && mod.default.name) {
      const plugin: Plugin = mod.default
      plugins.set(plugin.name, plugin)
    }
  }

  return plugins
}

/**
 * Parse plugin content: extract optional "subtitle: ..." first line
 */
export function parsePluginContent(rawContent: string): { content: string; subtitle?: string } {
  const lines = rawContent.trimStart().split('\n')
  const firstLine = lines[0]?.trim() || ''
  if (/^subtitle\s*:/i.test(firstLine)) {
    const subtitle = firstLine.replace(/^subtitle\s*:\s*/i, '').trim()
    const content = lines.slice(1).join('\n').trim()
    return { content, subtitle }
  }
  return { content: rawContent.trim() }
}

/**
 * Wrap output HTML in a <figure> with optional <figcaption> if subtitle is provided.
 */
function wrapWithSubtitle(html: string, subtitle?: string): string {
  if (!subtitle) return html
  return `<figure class="plugin-figure">${html}<figcaption class="plugin-caption">${subtitle}</figcaption></figure>`
}

/** Execute a single plugin on its content. Async for LLM plugins. */
export async function executePlugin(
  plugin: Plugin,
  input: PluginInput,
  id: string,
  noCache = false,
  /** Previously generated outputs from the same plugin type, for style consistency */
  priorOutputs: string[] = [],
): Promise<string> {
  if (plugin.mode === 'deterministic') {
    const output = plugin.render(input.content, id)
    return wrapWithLayoutHints(wrapWithSubtitle(output, input.subtitle), plugin.layoutHints)
  }

  // LLM plugin
  if (!isLLMConfigured()) {
    throw new Error(`[${plugin.name}] LLM not configured. Set LLM_API_KEY and LLM_BASE_URL (e.g. in .env file).`)
  }

  // Build user prompt: context + prior outputs + content
  const promptParts: string[] = []
  if (input.context) {
    promptParts.push(`SURROUNDING ARTICLE CONTEXT (for understanding what this visual illustrates — do NOT render this text):\n---\n${input.context}\n---`)
  }
  if (priorOutputs.length > 0) {
    promptParts.push(`PREVIOUSLY GENERATED ${plugin.name.toUpperCase()}S IN THIS DOCUMENT (match the same styling, color scheme, fonts, and overall aesthetic — consistency is critical):\n---\n${priorOutputs.join('\n---\n')}\n---`)
  }
  promptParts.push(`VISUAL TO GENERATE:\n${input.content}`)
  const userPrompt = promptParts.join('\n\n')

  const fullSystemPrompt = `${plugin.systemPrompt}\n\n${plugin.guidelines}`
  const response = await callLLM(fullSystemPrompt, userPrompt, noCache)
  const output = plugin.extractContent(response)
  return wrapWithLayoutHints(wrapWithSubtitle(output, input.subtitle), plugin.layoutHints)
}

/**
 * Wrap plugin output with data-layout-* attributes so the layout engine
 * can read layout hints generically without per-type branching.
 */
function wrapWithLayoutHints(html: string, hints?: LayoutHints): string {
  if (!hints) return html
  const attrs = [
    `data-layout-span-key="${hints.spanKey}"`,
    `data-layout-default-span="${hints.defaultSpan}"`,
  ]
  if (hints.marginTop != null) attrs.push(`data-layout-margin-top="${hints.marginTop}"`)
  if (hints.marginBottom != null) attrs.push(`data-layout-margin-bottom="${hints.marginBottom}"`)
  if (hints.textAlign) attrs.push(`data-layout-text-align="${hints.textAlign}"`)
  return `<div ${attrs.join(' ')}>${html}</div>`
}

// ═══════════════════════════════════════════════════════
// Plugin resolution (compile-time orchestration)
// ═══════════════════════════════════════════════════════

import type { Token } from './parser.js'

/**
 * Resolve plugin tokens to final HTML. Async because LLM plugins require API calls.
 */
export async function resolvePlugins(
  tokens: Token[],
  plugins: Map<string, Plugin>,
  noCache = false,
): Promise<{ html: string; clientScripts: string[] }> {
  const htmlParts: string[] = []
  const clientScripts: string[] = []
  let pluginCounter = 0

  // Track prior LLM outputs per plugin name for style consistency
  const priorOutputs = new Map<string, string[]>()

  for (const token of tokens) {
    if (token.type === 'block-start') {
      htmlParts.push('<div class="layout-block">')
      continue
    }
    if (token.type === 'block-end') {
      htmlParts.push('</div><!-- /layout-block -->')
      continue
    }
    if (token.type === 'html') {
      htmlParts.push(`<div class="md-block">${token.content}</div>`)
    } else {
      const plugin = plugins.get(token.pluginName)
      if (!plugin) {
        htmlParts.push(`<div class="plugin-error">Unknown plugin: ${token.pluginName}</div>`)
        continue
      }

      const id = `plugin-${token.pluginName}-${pluginCounter++}`
      console.log(`  Executing plugin: ${token.pluginName} (${plugin.mode})`)
      const { content, subtitle } = parsePluginContent(token.content)
      const input: PluginInput = { content, subtitle, context: token.context }
      const prior = priorOutputs.get(token.pluginName) || []
      const result = await executePlugin(plugin, input, id, noCache, prior)
      htmlParts.push(result)

      // Store output for subsequent calls of the same plugin type
      if (plugin.mode === 'llm') {
        if (!priorOutputs.has(token.pluginName)) priorOutputs.set(token.pluginName, [])
        priorOutputs.get(token.pluginName)!.push(result)
      }
    }
  }

  // Call finalize() on any plugins that support it (e.g. citations → references section)
  for (const plugin of plugins.values()) {
    if (plugin.mode === 'deterministic' && plugin.finalize) {
      const finalHtml = plugin.finalize()
      if (finalHtml) {
        const hints = plugin.finalizeLayoutHints || plugin.layoutHints
        if (hints) {
          const attrs = [
            `data-layout-span-key="${hints.spanKey}"`,
            `data-layout-default-span="${hints.defaultSpan}"`,
          ]
          if (hints.marginTop != null) attrs.push(`data-layout-margin-top="${hints.marginTop}"`)
          if (hints.marginBottom != null) attrs.push(`data-layout-margin-bottom="${hints.marginBottom}"`)
          if (hints.textAlign) attrs.push(`data-layout-text-align="${hints.textAlign}"`)
          htmlParts.push(`<div ${attrs.join(' ')}>${finalHtml}</div>`)
        } else {
          htmlParts.push(finalHtml)
        }
      }
    }
  }

  return { html: htmlParts.join('\n'), clientScripts }
}
