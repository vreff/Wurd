/**
 * Citation plugin — deterministic, stateful.
 *
 * Usage (inline):
 *   \[plugin:cite]Author, "Title", Year, URL\[/plugin]
 *   \[plugin:cite]Author, "Title", Year\[/plugin]
 *
 * Renders a superscript [1] in-text and collects all citations.
 * Call finalize() after the document is fully resolved to get the References section HTML.
 *
 * Content format (one citation per tag, fields separated by commas):
 *   Author(s), "Title", Year, URL (optional)
 *
 * The plugin parses flexibly — if the content has a URL (starts with http), it's extracted.
 * Everything else is treated as the citation description.
 */

interface Citation {
  id: number
  author: string
  title: string
  year: string
  url?: string
}

const citations: Citation[] = []
const seen = new Map<string, number>() // dedup by normalized content

function parseCitation(content: string): Omit<Citation, 'id'> {
  const trimmed = content.trim()

  // Try to extract URL (last comma-separated part starting with http)
  const parts = trimmed.split(',').map(s => s.trim())
  let url: string | undefined
  const lastPart = parts[parts.length - 1] || ''
  if (/^https?:\/\//.test(lastPart)) {
    url = lastPart
    parts.pop()
  }

  // Try to extract year (a 4-digit number)
  let year = ''
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d{4}$/.test(parts[i]!)) {
      year = parts[i]!
      parts.splice(i, 1)
      break
    }
  }

  // Try to extract title (in quotes)
  let title = ''
  const joined = parts.join(', ')
  const titleMatch = joined.match(/"([^"]+)"/)
  if (titleMatch) {
    title = titleMatch[1]!
    const author = joined.replace(/"[^"]*"/, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim()
    return { author, title, year, url }
  }

  // Fallback: first part is author, rest is title
  const author = parts[0] || ''
  title = parts.slice(1).join(', ') || ''

  return { author, title, year, url }
}

function reset() {
  citations.length = 0
  seen.clear()
}

const plugin = {
  name: 'cite',
  mode: 'deterministic' as const,

  layoutHints: {
    spanKey: 'citations',
    defaultSpan: 'column' as const,
  },

  finalizeLayoutHints: {
    spanKey: 'references',
    defaultSpan: 'column' as const,
    marginTop: 40,
    marginBottom: 20,
  },

  assets: {
    css: `
    .cite-ref a {
      color: #6ba3f7;
      text-decoration: none;
      font-size: 0.75em;
      vertical-align: super;
      line-height: 0;
    }
    .cite-ref a:hover { text-decoration: underline; }
    .references-section {
      margin-top: 40px;
      padding-top: 24px;
      border-top: 1px solid rgba(255,255,255,0.15);
    }
    .references-heading {
      font-size: 24px;
      font-weight: 700;
      color: var(--heading-color);
      margin-bottom: 16px;
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
    }
    .references-list {
      padding-left: 24px;
      color: rgba(255,255,255,0.7);
      font-size: 15px;
      line-height: 1.6;
    }
    .cite-item {
      margin-bottom: 8px;
    }
    .cite-item a {
      color: #6ba3f7;
      word-break: break-all;
    }
    `,
  },

  render(content: string, id: string): string {
    const normalized = content.trim().toLowerCase()

    // Dedup — same citation text returns the same number
    if (seen.has(normalized)) {
      const num = seen.get(normalized)!
      return `<sup class="cite-ref"><a href="#cite-${num}">[${num}]</a></sup>`
    }

    const parsed = parseCitation(content)
    const num = citations.length + 1
    const citation: Citation = { id: num, ...parsed }
    citations.push(citation)
    seen.set(normalized, num)

    return `<sup class="cite-ref"><a href="#cite-${num}">[${num}]</a></sup>`
  },

  /** Call after document resolution to get the References section HTML. Resets state. */
  finalize(): string | null {
    if (citations.length === 0) return null

    const items = citations.map(c => {
      const parts: string[] = []
      if (c.author) parts.push(c.author)
      if (c.title) parts.push(`"${c.title}"`)
      if (c.year) parts.push(c.year)

      let text = parts.join(', ')
      if (c.url) {
        text += `. <a href="${c.url}" target="_blank" rel="noopener">${c.url}</a>`
      }

      return `<li id="cite-${c.id}" class="cite-item">${text}</li>`
    })

    const html = `<div class="references-section">
  <h2 class="references-heading">References</h2>
  <ol class="references-list">${items.join('\n    ')}</ol>
</div>`

    reset()
    return html
  },
}

export default plugin
