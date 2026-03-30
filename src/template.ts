export interface StyleConfig {
  [key: string]: string | number | boolean
}

export interface OgMeta {
  description?: string
  image?: string
  url?: string
  type?: string
  siteName?: string
}

export function renderPage(
  title: string,
  bodyHtml: string,
  clientScripts: string[],
  bundledRuntime: string,
  styleConfig?: StyleConfig,
  pluginCss: string[] = [],
  pluginHeadElements: string[] = [],
  og?: OgMeta,
): string {
  const themeAttr = styleConfig && Object.keys(styleConfig).length > 0
    ? ` data-theme="${escapeAttr(JSON.stringify(styleConfig))}"`
    : ''

  // Plugin-declared head elements (e.g. CDN links for KaTeX)
  const headElementsHtml = pluginHeadElements.length > 0
    ? pluginHeadElements.map(el => `  ${el}`).join('\n')
    : ''

  // Plugin-declared CSS
  const pluginCssBlock = pluginCss.length > 0
    ? `\n    /* === Plugin styles === */\n${pluginCss.join('\n')}`
    : ''

  const pluginScripts = clientScripts.length > 0
    ? `<script>\n${clientScripts.join('\n')}\n</script>`
    : ''

  return `<!DOCTYPE html>
<html lang="en"${themeAttr}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>${og ? `
  <meta property="og:title" content="${escapeAttr(title)}">
  <meta property="og:type" content="${escapeAttr(og.type || 'article')}">${og.description ? `
  <meta property="og:description" content="${escapeAttr(og.description)}">
  <meta name="description" content="${escapeAttr(og.description)}">` : ''}${og.image ? `
  <meta property="og:image" content="${escapeAttr(og.image)}">` : ''}${og.url ? `
  <meta property="og:url" content="${escapeAttr(og.url)}">` : ''}${og.siteName ? `
  <meta property="og:site_name" content="${escapeAttr(og.siteName)}">` : ''}
  <meta name="twitter:card" content="${og.image ? 'summary_large_image' : 'summary'}">
  <meta name="twitter:title" content="${escapeAttr(title)}">${og.description ? `
  <meta name="twitter:description" content="${escapeAttr(og.description)}">` : ''}${og.image ? `
  <meta name="twitter:image" content="${escapeAttr(og.image)}">` : ''}` : ''}
${headElementsHtml}
  <style>
    /* === CSS Custom Properties (theme-driven) === */
    :root {
      --bg-color: #0f0f1a;
      --text-color: rgba(255,255,255,0.88);
      --heading-color: rgba(255,255,255,0.95);
      --accent-color: #c4a35a;
      --pq-color: rgba(255,255,255,0.7);
      --pq-border-color: #6b5a3d;
    }

    /* === Base === */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html {
      background: var(--bg-color);
      color: var(--text-color);
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
      font-size: 18px;
      line-height: 30px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body { min-height: 100vh; overflow-x: hidden; }

    #article { position: relative; width: 100%; }
    #content-source { display: none; }
    #pretext-stage { position: relative; width: 100%; }

    /* === Pretext lines (editorial engine pattern: <span> with absolute positioning) === */
    .pretext-line {
      position: absolute;
      white-space: pre;
      user-select: text;
      cursor: text;
      color: var(--heading-color);
      z-index: 1;
    }
    .heading-underline {
      position: absolute;
      pointer-events: none;
    }

    .headline-line {
      position: absolute;
      white-space: pre;
      user-select: text;
      color: var(--heading-color);
      z-index: 2;
    }

    /* === Drop Cap (editorial engine feature) === */
    .drop-cap {
      float: left;
      pointer-events: none;
      z-index: 2;
      font-weight: 700;
      color: var(--accent-color);
    }

    .drop-cap-paragraph {
      text-indent: 0;
    }

    /* === Pull Quotes (editorial engine feature) === */
    .pull-quote {
      border-left: 3px solid var(--pq-border-color);
      padding: 12px 14px 12px 18px;
      font-style: italic;
      color: var(--pq-color);
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
      line-height: 1.5;
    }
    .pull-quote p {
      margin: 0;
      font-style: italic;
    }
    .pull-quote strong, .pull-quote b {
      font-weight: 700;
      color: var(--heading-color);
    }

    /* === Multi-column flow containers === */
    .column-flow {
      orphans: 2;
      widows: 2;
    }
    .column-flow p {
      break-inside: avoid;
    }
    .column-flow .column-span-all {
      column-span: all;
      break-inside: avoid;
    }

    /* === Markdown block (hidden, used as source; children extracted by layout engine) === */
    .md-block { display: contents; }
    .md-block h1, .md-block h2, .md-block h3, .md-block h4, .md-block h5, .md-block h6 {
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
      font-weight: 700;
      color: var(--heading-color);
    }
    .md-block p {
      color: var(--text-color);
    }
    .md-block strong, .md-block b { font-weight: 700; color: var(--heading-color); }
    .md-block em, .md-block i { font-style: italic; }
    .md-block code {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 0.9em;
      background: rgba(255,255,255,0.06);
      padding: 2px 6px;
      border-radius: 3px;
    }
    .md-block a {
      color: #7eb8ff;
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    /* === Plugin figure/caption (generic subtitle wrapper) === */
    .plugin-figure {
      text-align: center;
    }
    .plugin-caption {
      font-size: 15px;
      color: rgba(255,255,255,0.6);
      margin-top: 10px;
      font-style: italic;
      font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif;
    }

    /* === Lists (positioned by layout engine) === */
    ul, ol {
      padding-left: 24px;
      color: rgba(255,255,255,0.88);
    }
    li {
      margin-bottom: 4px;
    }

    /* === Plugin error === */
    .plugin-error {
      background: rgba(255,60,60,0.1);
      border: 1px solid rgba(255,60,60,0.3);
      padding: 12px;
      border-radius: 6px;
      color: #ff6b6b;
      font-size: 14px;
    }

    /* === Responsive === */
    @media (max-width: 759px) {
      html { font-size: 16px; line-height: 26px; }
    }
${pluginCssBlock}
  </style>
</head>
<body>
  <div id="article">
    <div id="content-source">
      ${bodyHtml}
    </div>
  </div>
  ${pluginScripts}
  <script type="module">
${bundledRuntime}
  </script>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
