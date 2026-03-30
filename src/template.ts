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

    /* === PDF Button === */
    #pdf-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(30,30,50,0.85);
      backdrop-filter: blur(8px);
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s, background 0.2s;
      opacity: 0.6;
    }
    #pdf-btn:hover { opacity: 1; background: rgba(50,50,80,0.9); }
    #pdf-btn.loading { pointer-events: none; opacity: 0.4; }

    /* === Responsive === */
    @media (max-width: 759px) {
      html { font-size: 16px; line-height: 26px; }
    }
${pluginCssBlock}
  </style>
</head>
<body>
  <button id="pdf-btn" aria-label="Save as PDF" title="Save as PDF">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  </button>
  <script>
  document.getElementById('pdf-btn').addEventListener('click', async function() {
    const btn = this;
    btn.classList.add('loading');
    function loadScript(src) {
      return new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = src; s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    try {
      if (!window.html2canvas) await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
      if (!window.jspdf) await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js');
      const stage = document.getElementById('stage') || document.body;
      var stageH = stage.scrollHeight || stage.offsetHeight;
      var stageW = stage.scrollWidth || stage.offsetWidth;
      // Browsers cap canvas at ~32k px per dimension and ~124M total pixels
      var maxDim = 32000;
      var maxArea = 120000000;
      var scale = 2;
      while ((stageW * scale > maxDim) || (stageH * scale > maxDim) || (stageW * scale * stageH * scale > maxArea)) { scale = scale * 0.75; }
      scale = Math.max(scale, 0.5);
      const canvas = await window.html2canvas(stage, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim() || '#0f0f1a',
        scale: scale,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pxToMm = 0.264583;
      const w = canvas.width * pxToMm / scale;
      const h = canvas.height * pxToMm / scale;
      const pdf = new window.jspdf.jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'mm', format: [Math.min(w, 14400), Math.min(h, 14400)] });
      pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
      pdf.save((document.title || 'document') + '.pdf');
    } catch(e) { console.error('PDF generation failed:', e); alert('PDF export failed: ' + e.message); }
    finally { btn.classList.remove('loading'); }
  });
  </script>
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
