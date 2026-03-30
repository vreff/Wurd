import type { LLMPlugin } from '../../src/plugins.js'
import { runInNewContext } from 'vm'

const graphPlugin: LLMPlugin = {
  name: 'graph',
  mode: 'llm',

  layoutHints: {
    spanKey: 'graphs',
    defaultSpan: 'column',
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },

  assets: {
    css: `
    .graph-figure {
      text-align: center;
    }
    .graph-canvas {
      border-radius: 8px;
      max-width: 100%;
      height: auto;
    }
    .graph-figure figcaption {
      font-size: 14px;
      color: rgba(255,255,255,0.5);
      margin-top: 8px;
      font-style: italic;
    }
    `,
  },

  systemPrompt: `You are an expert data visualization developer. Given a description of a chart or graph, write JavaScript code that builds an SVG string.

You have full creative freedom over how you structure the code, what helpers you write, how you lay out elements, and what visual flourishes you add. The only hard constraints are:

1. Output a single fenced JavaScript code block (\`\`\`javascript ... \`\`\`). Nothing else outside the fence.
2. Your code must assign the final SVG string to a bare global: result = svg;  (no let/const/var before "result").
3. Use string concatenation with single quotes to build SVG. Do NOT use backtick template literals.
4. The SVG must be self-contained with inline styles — no external CSS or dependencies.
5. Use viewBox="0 0 700 450" for the SVG dimensions.
6. Mathematically compute curve coordinates — evaluate the function at many x-values for smooth polylines. Every stated data point MUST lie exactly on its curve.

Beyond these constraints, you decide the layout, colors, fonts, spacing, grid style, legend placement, annotations, and any other visual details. Make it look polished and professional.

If surrounding article context is provided, use it to understand what the visual is illustrating and tailor the design accordingly.`,

  guidelines: `Default visual direction (the user or article context may override these):
- Dark theme background (~#1a1a2e), rounded corners
- Clean, modern aesthetic with readable labels
- Grid lines subtle, axes visible but not dominant
- Smooth curves with good stroke width
- Data points as visible filled circles
- Legend that fits within the chart bounds
- Title centered at top
- System-ui or sans-serif font family for labels`,

  extractContent(response: string): string {
    // Extract JavaScript code from the response
    const codeMatch = response.match(/```(?:javascript|js)?\s*\n([\s\S]*?)```/)
    if (!codeMatch) {
      const rawCode = response.trim()
      if (rawCode.includes('svg') || rawCode.includes('result')) {
        return executeGraphCode(rawCode)
      }
      throw new Error(`Graph plugin: no JavaScript code block found. Response preview: ${response.slice(0, 300)}`)
    }
    return executeGraphCode(codeMatch[1])
  },
}

function executeGraphCode(code: string): string {
  // Fix common LLM mistakes: "let result = " / "const result = " → bare "result = "
  let fixedCode = code
    .replace(/\b(let|const|var)\s+result\s*=/g, 'result =')

  // Replace template literals with string concat (LLMs love backticks)
  // This handles simple cases: `text ${expr} text` → 'text ' + (expr) + ' text'
  // For complex cases, the template in the prompt already asks for single quotes.

  const sandbox: Record<string, any> = {
    result: '',
    svg: '',
    Math,
    parseInt,
    parseFloat,
    Number,
    String,
    Array,
    JSON,
    Object,
    Boolean,
    isNaN,
    isFinite,
    undefined,
    NaN,
    Infinity,
    console: { log() {}, warn() {}, error() {} },
  }

  try {
    runInNewContext(fixedCode, sandbox, { timeout: 5000 })
  } catch (execErr: any) {
    throw new Error(
      `Graph plugin: JS execution error: ${execErr.message}\n\nFull generated code:\n${fixedCode}`
    )
  }

  // Check result, fall back to svg variable
  const output = sandbox.result || sandbox.svg
  if (!output || !output.includes('<svg')) {
    throw new Error(
      `Graph plugin: code ran but produced no SVG.\n` +
      `sandbox.result = ${JSON.stringify(String(sandbox.result).slice(0, 100))}\n` +
      `sandbox.svg = ${JSON.stringify(String(sandbox.svg).slice(0, 100))}\n\n` +
      `Full generated code:\n${fixedCode}`
    )
  }
  return `<figure class="graph-figure">${output}</figure>`
}

export default graphPlugin
