/**
 * Pretext-powered editorial layout engine.
 *
 * - Pretext fitHeadline with binary search for headings (zero DOM measurement)
 * - Drop cap on the opening paragraph via Pretext measurement
 * - Pull quotes from blockquotes, centered with accent border
 * - Configurable theme via data-theme attribute on <html>
 * - Headings rendered as positioned <span> elements from Pretext line data
 * - Unified CSS-column flow for single and multi-column layouts
 * - Plugin layout driven entirely by data-layout-* attributes
 */
import {
  prepareWithSegments,
  walkLineRanges,
  layoutWithLines,
} from '@chenglou/pretext'

// ═══════════════════════════════════════════════════════
// Theme configuration
// ═══════════════════════════════════════════════════════

interface ThemeConfig {
  bodyFont: string
  bodyFontSize: number
  bodyLineHeight: number
  headingFontFamily: string
  gutter: number
  narrowGutter: number
  narrowBreakpoint: number
  maxContentWidth: number
  columns: number | 'auto' // 1 = single column, 2/3 = fixed, 'auto' = responsive
  columnGap: number
  columnWidth: number // target width per column in multi-column mode
  columnSpan: Set<string> // element types that span all columns (empty by default; opt-in via frontmatter)
  columnSpanExplicit: boolean // true when the user explicitly set columnSpan in frontmatter
  dropCap: boolean
  dropCapLines: number
  // Heading sizes
  h1MaxFontSize: number
  h2MaxFontSize: number
  h3MaxFontSize: number
  h1MaxHeight: number
  h2MaxHeight: number
  h3MaxHeight: number
  h1SpacingAbove: number
  h2SpacingAbove: number
  h3SpacingAbove: number
  headingSpacingBelow: number
  subheadingSpacingBelow: number
  headingMinFontSize: number
  headingLineHeightRatio: number
  // Auto-column breakpoints (used when columns: 'auto')
  threeColumnMinWidth: number
  twoColumnMinWidth: number
  // Pull quotes
  pullQuoteMaxWidth: number
  pullQuoteWidthRatio: number
  blockquoteSpacingAbove: number
  blockquoteSpacingBelow: number
  // Element spacing
  paragraphSpacing: number
  listSpacing: number
  rawSpacing: number
  sectionGap: number
  bgColor: string
  textColor: string
  headingColor: string
  accentColor: string
  pullQuoteColor: string
  pullQuoteBorderColor: string
  headingUnderline: string[] // element IDs that get underlines
  headingUnderlineColor: string
  pointerEventsNone: string[] // element IDs that get pointer-events: none
}

const THEME_DEFAULTS: ThemeConfig = {
  bodyFont: '18px "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif',
  bodyFontSize: 18,
  bodyLineHeight: 30,
  headingFontFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif',
  gutter: 48,
  narrowGutter: 20,
  narrowBreakpoint: 760,
  maxContentWidth: 720,
  columns: 1,
  columnGap: 40,
  columnWidth: 400,
  columnSpan: new Set<string>(),
  columnSpanExplicit: false,
  dropCap: false,
  dropCapLines: 3,
  h1MaxFontSize: 56,
  h2MaxFontSize: 38,
  h3MaxFontSize: 28,
  h1MaxHeight: 200,
  h2MaxHeight: 120,
  h3MaxHeight: 80,
  h1SpacingAbove: 20,
  h2SpacingAbove: 32,
  h3SpacingAbove: 20,
  headingSpacingBelow: 16,
  subheadingSpacingBelow: 10,
  headingMinFontSize: 18,
  headingLineHeightRatio: 1.15,
  threeColumnMinWidth: 1200,
  twoColumnMinWidth: 900,
  pullQuoteMaxWidth: 560,
  pullQuoteWidthRatio: 0.75,
  blockquoteSpacingAbove: 24,
  blockquoteSpacingBelow: 28,
  paragraphSpacing: 20,
  listSpacing: 16,
  rawSpacing: 12,
  sectionGap: 8,
  bgColor: '#0f0f1a',
  textColor: 'rgba(255,255,255,0.88)',
  headingColor: 'rgba(255,255,255,0.95)',
  accentColor: '#c4a35a',
  pullQuoteColor: 'rgba(255,255,255,0.7)',
  pullQuoteBorderColor: '#6b5a3d',
  headingUnderline: [],
  headingUnderlineColor: 'rgba(255,255,255,0.12)',
  pointerEventsNone: [],
}

function loadThemeConfig(): ThemeConfig {
  const raw = document.documentElement.getAttribute('data-theme')
  if (!raw) return { ...THEME_DEFAULTS, columnSpan: new Set(THEME_DEFAULTS.columnSpan) }
  try {
    const overrides = JSON.parse(raw) as Record<string, unknown>
    const base = { ...THEME_DEFAULTS, ...overrides }
    // Parse columnSpan: comes as comma-separated string from frontmatter
    if (typeof overrides.columnSpan === 'string') {
      base.columnSpan = new Set(
        (overrides.columnSpan as string).split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      )
      base.columnSpanExplicit = true
    } else {
      base.columnSpan = new Set(THEME_DEFAULTS.columnSpan)
      base.columnSpanExplicit = false
    }
    // Parse headingUnderline: comes as comma-separated list of element IDs
    const huVal = overrides.headingUnderline
    if (typeof huVal === 'string') {
      base.headingUnderline = huVal.split(',').map(s => s.trim()).filter(Boolean)
    } else if (typeof huVal === 'number') {
      base.headingUnderline = [String(huVal)]
    } else {
      base.headingUnderline = THEME_DEFAULTS.headingUnderline
    }
    // Parse pointerEventsNone: comes as comma-separated list of element IDs
    const peVal = overrides.pointerEventsNone
    if (typeof peVal === 'string') {
      base.pointerEventsNone = peVal.split(',').map(s => s.trim()).filter(Boolean)
    } else if (typeof peVal === 'number') {
      base.pointerEventsNone = [String(peVal)]
    } else {
      base.pointerEventsNone = THEME_DEFAULTS.pointerEventsNone
    }
    return base as ThemeConfig
  } catch {
    return { ...THEME_DEFAULTS, columnSpan: new Set(THEME_DEFAULTS.columnSpan) }
  }
}

// ═══════════════════════════════════════════════════════
// Types (from editorial engine)
// ═══════════════════════════════════════════════════════

type PositionedLine = {
  x: number
  y: number
  width: number
  text: string
  font: string
  lineHeight: number
  headingLevel?: number
  elementId?: string
}

// ═══════════════════════════════════════════════════════
// Headline fitting via Pretext binary search
// ═══════════════════════════════════════════════════════

function fitHeadline(
  text: string,
  maxWidth: number,
  maxHeight: number,
  fontFamily: string,
  maxSize: number = 72,
  minSize: number = 18,
  lineHeightRatio: number = 1.15,
): { fontSize: number; lines: PositionedLine[] } {
  let lo = minSize
  let hi = maxSize
  let best = lo
  let bestLines: PositionedLine[] = []

  while (lo <= hi) {
    const size = Math.floor((lo + hi) / 2)
    const font = `700 ${size}px ${fontFamily}`
    const lineHeight = Math.round(size * lineHeightRatio)
    const prepared = prepareWithSegments(text, font)
    let breaksWord = false
    let lineCount = 0

    walkLineRanges(prepared, maxWidth, line => {
      lineCount++
      if (line.end.graphemeIndex !== 0) breaksWord = true
    })

    const totalHeight = lineCount * lineHeight
    if (!breaksWord && totalHeight <= maxHeight) {
      best = size
      const result = layoutWithLines(prepared, maxWidth, lineHeight)
      bestLines = result.lines.map((line, i) => ({
        x: 0,
        y: i * lineHeight,
        text: line.text,
        width: line.width,
        font,
        lineHeight,
      }))
      lo = size + 1
    } else {
      hi = size - 1
    }
  }

  return { fontSize: best, lines: bestLines }
}

// ═══════════════════════════════════════════════════════
// Section parsing from content-source DOM
// ═══════════════════════════════════════════════════════

interface LayoutSection {
  type: 'heading' | 'paragraph' | 'plugin' | 'list' | 'blockquote' | 'raw' | 'block'
  element: HTMLElement
  text?: string
  level?: number
  elementId?: string
  hasRichContent?: boolean
  /** Layout hints from plugin data attributes */
  layoutHints?: {
    spanKey: string
    defaultSpan: 'all' | 'column'
    marginTop: number
    marginBottom: number
    textAlign?: string
  }
  /** Child sections for block groups */
  children?: LayoutSection[]
}

function parseChildren(children: HTMLElement[]): LayoutSection[] {
  const sections: LayoutSection[] = []

  for (const child of children) {
    if (child.classList.contains('layout-block')) {
      const blockChildren = parseChildren(Array.from(child.children) as HTMLElement[])
      sections.push({ type: 'block', element: child, children: blockChildren })
    } else if (child.classList.contains('md-block')) {
      const inner = Array.from(child.children) as HTMLElement[]
      for (const el of inner) {
        const tag = el.tagName.toLowerCase()
        if (/^h[1-6]$/.test(tag)) {
          let headingText = el.textContent || ''
          let elementId: string | undefined
          const idMatch = headingText.match(/\s*\{#([\w-]+)\}\s*$/)
          if (idMatch) {
            elementId = idMatch[1]
            headingText = headingText.slice(0, idMatch.index).trim()
          } else if (el.id) {
            elementId = el.id
          }
          sections.push({
            type: 'heading',
            element: el,
            text: headingText,
            level: parseInt(tag[1]!, 10),
            elementId,
          })
        } else if (tag === 'p') {
          sections.push({
            type: 'paragraph',
            element: el,
            text: el.textContent || '',
            hasRichContent: el.querySelector('span, a, code, .katex, sup') !== null,
          })
        } else if (tag === 'blockquote') {
          sections.push({
            type: 'blockquote',
            element: el,
            text: el.textContent || '',
          })
        } else if (tag === 'ul' || tag === 'ol') {
          sections.push({ type: 'list', element: el })
        } else {
          sections.push({ type: 'raw', element: el })
        }
      }
    } else if (child.hasAttribute('data-layout-span-key')) {
      // Plugin output with layout hints
      const hints = readLayoutHints(child)
      sections.push({ type: 'plugin', element: child, layoutHints: hints })
    } else {
      sections.push({ type: 'raw', element: child })
    }
  }

  return sections
}

function parseSections(contentEl: HTMLElement): LayoutSection[] {
  return parseChildren(Array.from(contentEl.children) as HTMLElement[])
}

function readLayoutHints(el: HTMLElement) {
  return {
    spanKey: el.getAttribute('data-layout-span-key') || '',
    defaultSpan: (el.getAttribute('data-layout-default-span') || 'column') as 'all' | 'column',
    marginTop: parseInt(el.getAttribute('data-layout-margin-top') || '16', 10),
    marginBottom: parseInt(el.getAttribute('data-layout-margin-bottom') || '20', 10),
    textAlign: el.getAttribute('data-layout-text-align') || undefined,
  }
}

// ═══════════════════════════════════════════════════════
// Pool management (from editorial engine)
// ═══════════════════════════════════════════════════════

function syncPool(pool: HTMLElement[], count: number, className: string, container: HTMLElement): void {
  while (pool.length < count) {
    const el = document.createElement('span')
    el.className = className
    container.appendChild(el)
    pool.push(el)
  }
  for (let i = 0; i < pool.length; i++) {
    pool[i]!.style.display = i < count ? '' : 'none'
  }
}

// ═══════════════════════════════════════════════════════
// Main layout engine
// ═══════════════════════════════════════════════════════

export function initPretextLayout(): void {
  const article = document.getElementById('article')
  if (!article) return

  const contentSource = document.getElementById('content-source')
  if (!contentSource) return

  const theme = loadThemeConfig()
  const sections = parseSections(contentSource)

  // Apply theme colors to the document
  document.documentElement.style.setProperty('--bg-color', theme.bgColor)
  document.documentElement.style.setProperty('--text-color', theme.textColor)
  document.documentElement.style.setProperty('--heading-color', theme.headingColor)
  document.documentElement.style.setProperty('--accent-color', theme.accentColor)
  document.documentElement.style.setProperty('--pq-color', theme.pullQuoteColor)
  document.documentElement.style.setProperty('--pq-border-color', theme.pullQuoteBorderColor)

  const stage = document.createElement('div')
  stage.id = 'pretext-stage'
  stage.style.position = 'relative'
  article.appendChild(stage)

  contentSource.style.display = 'none'

  const linePool: HTMLSpanElement[] = []
  const underlinePool: HTMLElement[] = []

  // Identify first body paragraph for drop cap
  const firstParaIdx = sections.findIndex(s => s.type === 'paragraph')

  // Drop cap setup using Pretext measurement
  let dropCapEl: HTMLDivElement | null = null
  let dropCapWidth = 0

  if (theme.dropCap && firstParaIdx >= 0) {
    const firstPara = sections[firstParaIdx]!
    const firstChar = firstPara.text?.[0]
    if (firstChar) {
      const dropCapSize = theme.bodyLineHeight * theme.dropCapLines - 4
      const dropCapFont = `700 ${dropCapSize}px ${theme.headingFontFamily}`
      const prepared = prepareWithSegments(firstChar, dropCapFont)
      walkLineRanges(prepared, 9999, line => {
        dropCapWidth = Math.ceil(line.width) + 10
      })

      dropCapEl = document.createElement('div')
      dropCapEl.className = 'drop-cap'
      dropCapEl.textContent = firstChar
      dropCapEl.style.font = dropCapFont
      dropCapEl.style.lineHeight = `${dropCapSize}px`
      stage.appendChild(dropCapEl)
    }
  }

  function render(): void {
    const pageWidth = document.documentElement.clientWidth
    const isNarrow = pageWidth < theme.narrowBreakpoint
    const hGutter = isNarrow ? theme.narrowGutter : theme.gutter
    const vGutter = theme.gutter // vertical padding stays consistent

    // Resolve effective column count
    let effectiveColumns = 1
    if (theme.columns === 'auto') {
      effectiveColumns = pageWidth > theme.threeColumnMinWidth ? 3 : pageWidth > theme.twoColumnMinWidth ? 2 : 1
    } else {
      effectiveColumns = isNarrow ? 1 : theme.columns
    }

    // Widen max content for multi-column layouts
    const maxW = effectiveColumns > 1
      ? Math.min(pageWidth - hGutter * 2, effectiveColumns * theme.columnWidth + (effectiveColumns - 1) * theme.columnGap)
      : theme.maxContentWidth
    const contentWidth = Math.min(pageWidth - hGutter * 2, maxW)
    const contentLeft = Math.round((pageWidth - contentWidth) / 2)

    // Expose content boundaries as CSS custom properties for plugins
    stage.style.setProperty('--content-left', `${contentLeft}px`)
    stage.style.setProperty('--content-right', `${contentLeft}px`)
    stage.style.setProperty('--content-width', `${contentWidth}px`)

    let y = vGutter
    const allLines: PositionedLine[] = []
    const underlines: { x: number; y: number; width: number }[] = []

    // Clean up old flow containers
    stage.querySelectorAll('.column-flow').forEach(el => el.remove())

    // Group sections: heading → flow group → heading → flow group ...
    type FlowGroup = { type: 'heading'; section: LayoutSection } | { type: 'flow'; sections: LayoutSection[] }
    const groups: FlowGroup[] = []
    let currentFlow: LayoutSection[] = []

    for (const section of sections) {
      if (section.type === 'heading') {
        if (currentFlow.length > 0) {
          groups.push({ type: 'flow', sections: currentFlow })
          currentFlow = []
        }
        groups.push({ type: 'heading', section })
      } else {
        currentFlow.push(section)
      }
    }
    if (currentFlow.length > 0) {
      groups.push({ type: 'flow', sections: currentFlow })
    }

    for (const group of groups) {
      if (group.type === 'heading') {
        const section = group.section
        const level = section.level || 2
        const maxFontSize = level === 1 ? theme.h1MaxFontSize : level === 2 ? theme.h2MaxFontSize : theme.h3MaxFontSize
        const maxHeight = level === 1 ? theme.h1MaxHeight : level === 2 ? theme.h2MaxHeight : theme.h3MaxHeight
        y += level === 1 ? theme.h1SpacingAbove : level === 2 ? theme.h2SpacingAbove : theme.h3SpacingAbove

        const { lines: headLines } = fitHeadline(
          section.text!,
          contentWidth,
          maxHeight,
          theme.headingFontFamily,
          maxFontSize,
          theme.headingMinFontSize,
          theme.headingLineHeightRatio,
        )
        for (const hl of headLines) {
          allLines.push({ ...hl, x: contentLeft + hl.x, y: y + hl.y, headingLevel: level, elementId: section.elementId })
        }
        const headingBlockHeight = headLines.length * (headLines[0]?.lineHeight || 30)
        y += headingBlockHeight + (level <= 2 ? theme.headingSpacingBelow : theme.subheadingSpacingBelow)

        if (section.elementId && theme.headingUnderline.includes(section.elementId)) {
          underlines.push({ x: contentLeft, y: y - (level <= 2 ? theme.headingSpacingBelow : theme.subheadingSpacingBelow) / 2, width: contentWidth })
        }

      } else {
        // Create a flow container — CSS columns handle both single and multi-column
        const flowDiv = document.createElement('div')
        flowDiv.className = 'column-flow'
        flowDiv.style.position = 'absolute'
        flowDiv.style.left = `${contentLeft}px`
        flowDiv.style.top = `${y}px`
        flowDiv.style.width = `${contentWidth}px`
        if (effectiveColumns > 1) {
          flowDiv.style.columnCount = `${effectiveColumns}`
          flowDiv.style.columnGap = `${theme.columnGap}px`
        }
        flowDiv.style.font = theme.bodyFont
        flowDiv.style.lineHeight = `${theme.bodyLineHeight}px`
        flowDiv.style.color = theme.textColor

        function appendSection(section: LayoutSection, container: HTMLElement): void {
          const el = section.element

          // Reset absolute positioning — these flow naturally
          el.style.position = ''
          el.style.left = ''
          el.style.top = ''
          el.style.width = ''
          el.style.maxWidth = ''

          if (section.type === 'block') {
            el.style.breakInside = 'avoid'
            for (const child of section.children || []) {
              appendSection(child, el)
            }
            container.appendChild(el)
          } else if (section.type === 'paragraph') {
            el.style.font = theme.bodyFont
            el.style.lineHeight = `${theme.bodyLineHeight}px`
            el.style.color = theme.textColor
            el.style.marginBottom = `${theme.paragraphSpacing}px`
            // Handle drop cap for first paragraph in document
            const isFirstPara = sections.indexOf(section) === firstParaIdx && theme.dropCap && dropCapEl
            if (isFirstPara && dropCapEl) {
              el.classList.add('drop-cap-paragraph')
              if (!el.getAttribute('data-dropcap-applied')) {
                const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
                const firstTextNode = walker.nextNode()
                if (firstTextNode && firstTextNode.textContent) {
                  firstTextNode.textContent = firstTextNode.textContent.slice(1)
                }
                el.setAttribute('data-dropcap-applied', '1')
              }
              // Float the drop cap so text wraps around it for the first few lines only
              dropCapEl.style.cssFloat = 'left'
              dropCapEl.style.width = `${dropCapWidth}px`
              dropCapEl.style.marginRight = '4px'
              dropCapEl.style.lineHeight = '1'
              el.prepend(dropCapEl)
            }
            container.appendChild(el)
          } else if (section.type === 'blockquote') {
            el.classList.add('pull-quote')
            const spansAll = effectiveColumns > 1 && theme.columnSpanExplicit && theme.columnSpan.has('quotes')
            if (spansAll) el.classList.add('column-span-all')
            el.style.marginTop = `${theme.blockquoteSpacingAbove}px`
            el.style.marginBottom = `${theme.blockquoteSpacingBelow}px`
            // Size relative to column width when not spanning, full content width when spanning
            const baseWidth = (effectiveColumns > 1 && !spansAll)
              ? (contentWidth - (effectiveColumns - 1) * theme.columnGap) / effectiveColumns
              : contentWidth
            const pqWidth = Math.min(baseWidth * theme.pullQuoteWidthRatio, theme.pullQuoteMaxWidth)
            el.style.width = `${pqWidth}px`
            el.style.marginLeft = 'auto'
            el.style.marginRight = 'auto'
            container.appendChild(el)
          } else if (section.type === 'plugin' && section.layoutHints) {
            const hints = section.layoutHints
            if (effectiveColumns > 1) {
              const shouldSpan = theme.columnSpanExplicit
                ? theme.columnSpan.has(hints.spanKey)
                : hints.defaultSpan === 'all'
              if (shouldSpan) el.classList.add('column-span-all')
            }
            el.style.marginTop = `${hints.marginTop}px`
            el.style.marginBottom = `${hints.marginBottom}px`
            if (hints.textAlign) el.style.textAlign = hints.textAlign
            container.appendChild(el)
          } else if (section.type === 'list') {
            el.style.font = theme.bodyFont
            el.style.lineHeight = `${theme.bodyLineHeight}px`
            el.style.color = theme.textColor
            el.style.marginBottom = `${theme.listSpacing}px`
            container.appendChild(el)
          } else {
            el.style.marginBottom = `${theme.rawSpacing}px`
            container.appendChild(el)
          }
        }

        for (const section of group.sections) {
          appendSection(section, flowDiv)
        }

        stage.appendChild(flowDiv)
        const flowHeight = Math.ceil(flowDiv.getBoundingClientRect().height)
        y += flowHeight + theme.sectionGap
      }
    }

    // Render Pretext heading lines as <span> elements (editorial engine pattern)
    syncPool(linePool, allLines.length, 'pretext-line', stage)
    for (let i = 0; i < allLines.length; i++) {
      const el = linePool[i]!
      const line = allLines[i]!
      el.textContent = line.text
      el.style.left = `${line.x}px`
      el.style.top = `${line.y}px`
      el.style.font = line.font
      el.style.lineHeight = `${line.lineHeight}px`
      el.style.color = theme.headingColor
      const shouldDisablePointer = line.elementId && theme.pointerEventsNone.includes(line.elementId)
      el.style.pointerEvents = shouldDisablePointer ? 'none' : ''
    }

    // Render heading underlines
    syncPool(underlinePool, underlines.length, 'heading-underline', stage)
    for (let i = 0; i < underlines.length; i++) {
      const el = underlinePool[i]!
      const ul = underlines[i]!
      el.style.left = `${ul.x}px`
      el.style.top = `${ul.y}px`
      el.style.width = `${ul.width}px`
      el.style.height = '1px'
      el.style.backgroundColor = theme.headingUnderlineColor
    }

    stage.style.height = `${y + vGutter}px`
  }

  // Two-pass layout: first render after fonts ready, second pass to finalize
  // after any late font/layout changes (KaTeX CDN fonts).
  document.fonts.ready.then(() => {
    render()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        render()
        window.addEventListener('resize', render)
        // Let plugins trigger a re-layout (e.g. accordion toggle)
        document.addEventListener('pretext:relayout', render)
      })
    })
  })
}
