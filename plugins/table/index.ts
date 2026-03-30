import type { LLMPlugin } from '../../src/plugins.js'

/**
 * Table plugin — uses an LLM to generate styled HTML tables.
 *
 * Tag content is a natural-language description of the table data:
 *
 *   [plugin:table]
 *   A table with columns "Row Number" and "Values".
 *   Rows: 1 → 2, 2 → 4, 3 → 16.
 *   [/plugin]
 */
const tablePlugin: LLMPlugin = {
  name: 'table',
  mode: 'llm',

  layoutHints: {
    spanKey: 'tables',
    defaultSpan: 'column',
    marginTop: 16,
    marginBottom: 20,
  },

  assets: {
    css: `
    .table-wrapper {
      display: flex;
      justify-content: center;
    }
    .plugin-table {
      border-collapse: collapse;
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
      font-size: 16px;
      color: rgba(255,255,255,0.88);
    }
    .plugin-table th, .plugin-table td {
      border: 1px solid rgba(255,255,255,0.15);
      padding: 8px 20px;
      text-align: center;
    }
    .plugin-table th {
      background: rgba(255,255,255,0.06);
      font-weight: 700;
      color: rgba(255,255,255,0.95);
    }
    .plugin-table tr:nth-child(even) {
      background: rgba(255,255,255,0.02);
    }
    `,
  },

  systemPrompt: `You are an expert HTML table generator. Given a description of tabular data, generate a single styled HTML table.

Output ONLY the raw HTML, starting with <div and ending with </div>. No markdown, no code fences, no explanation.
Wrap the <table> in a centered flex container div. Use ALL inline styles — no external CSS.
If pipe-delimited data is provided, the first row is always the header.

If surrounding article context is provided, use it to understand what the table illustrates and tailor column headers, formatting, and emphasis accordingly.`,

  guidelines: `Default visual direction (the user or context may override):
- Dark theme, clean modern look
- Readable font, centered numeric data
- Subtle borders, alternating row shading
- Rounded container corners
- Consistent with a dark (#0f0f1a) page background`,

  extractContent(response: string): string {
    // Extract from <div> to </div> (outermost wrapper)
    const divMatch = response.match(/<div[\s\S]*<\/div>/i)
    if (divMatch) return divMatch[0]
    // Fallback: try <table>
    const tableMatch = response.match(/<table[\s\S]*<\/table>/i)
    if (tableMatch) return `<div style="display:flex;justify-content:center;margin:16px 0">${tableMatch[0]}</div>`
    return `<div class="plugin-error">Table plugin: LLM did not return valid HTML</div>`
  },
}

export default tablePlugin
