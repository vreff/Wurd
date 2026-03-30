#!/usr/bin/env npx tsx
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname, basename } from 'path'
import { fileURLToPath } from 'url'
import * as esbuild from 'esbuild'
import { parse, extractFrontmatter } from './parser.js'
import { loadPlugins, resolvePlugins } from './plugins.js'
import { renderPage } from './template.js'
import { initLLM } from './llm.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

/** Load .env file from project root if it exists */
function loadEnvFile(): void {
  const envPath = join(projectRoot, '.env')
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    // Don't override existing env vars
    if (!process.env[key]) {
      process.env[key] = val
    }
  }
}

async function main(): Promise<void> {
  loadEnvFile()

  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error('Usage: wurd <path-to-markdown> [--no-cache] [--plugins <dir>]')
    process.exit(1)
  }

  const noCache = process.argv.includes('--no-cache')

  // Optional extra plugin directories: --plugins /path/to/dir (repeatable)
  const extraPluginDirs: string[] = []
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--plugins' && process.argv[i + 1]) {
      const dir = process.argv[i + 1]!.startsWith('/')
        ? process.argv[i + 1]!
        : join(process.cwd(), process.argv[i + 1]!)
      extraPluginDirs.push(dir)
      i++ // skip the value
    }
  }

  // LLM configuration from environment variables
  // Supports LLM_API_KEY or falls back to OPENAI_API_KEY
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY
  const baseURL = process.env.LLM_BASE_URL || (process.env.OPENAI_API_KEY && !process.env.LLM_API_KEY ? 'https://api.openai.com/v1' : undefined)
  const model = process.env.LLM_MODEL || 'gpt-4o'

  if (apiKey && baseURL) {
    initLLM({ apiKey, baseURL, model })
    console.log(`LLM configured: ${baseURL} (model: ${model})`)
  } else {
    console.warn('⚠ LLM not configured. AI-driven plugins (graph, table) will fail.')
    console.warn('  Set LLM_API_KEY and LLM_BASE_URL in .env or environment to enable them.')
  }

  const resolvedInput = inputPath.startsWith('/')
    ? inputPath
    : join(process.cwd(), inputPath)

  console.log(`Compiling: ${resolvedInput}`)

  // Read markdown
  const rawMarkdown = readFileSync(resolvedInput, 'utf-8')

  // Extract frontmatter style config (if present)
  const { style: styleConfig, markdown } = extractFrontmatter(rawMarkdown)

  // Load plugins (built-in + any extra dirs)
  const pluginsDir = join(projectRoot, 'plugins')
  const plugins = await loadPlugins(pluginsDir)
  for (const dir of extraPluginDirs) {
    const extra = await loadPlugins(dir)
    for (const [name, plugin] of extra) {
      plugins.set(name, plugin)
    }
  }
  console.log(`Loaded plugins: ${Array.from(plugins.keys()).join(', ')}`)

  // Parse markdown + plugin tags (deterministic plugins pre-rendered inline)
  const tokens = parse(markdown, plugins)
  console.log(`Parsed ${tokens.length} tokens`)

  // Resolve plugins to HTML (async — LLM plugins call API)
  console.log('Resolving plugins...')
  const { html: bodyHtml, clientScripts } = await resolvePlugins(tokens, plugins, noCache)

  // Collect plugin-owned assets (CSS, head elements, runtime modules)
  const pluginCss: string[] = []
  const pluginHeadElements: string[] = []
  const pluginRuntimeModules: string[] = []
  for (const plugin of plugins.values()) {
    if (plugin.assets?.css) pluginCss.push(plugin.assets.css)
    if (plugin.assets?.headElements) pluginHeadElements.push(...plugin.assets.headElements)
    if (plugin.assets?.runtimeModule) pluginRuntimeModules.push(plugin.assets.runtimeModule)
  }

  // Generate virtual entry that imports core runtime + any plugin runtime modules
  const runtimeEntry = join(projectRoot, 'src', 'runtime', 'main.ts')
  let entrySource = `import '${runtimeEntry}';\n`
  pluginRuntimeModules.forEach((mod, i) => {
    entrySource += `import { init as pluginInit${i} } from '${mod}';\n`
  })
  if (pluginRuntimeModules.length > 0) {
    entrySource += `document.fonts.ready.then(() => {\n`
    pluginRuntimeModules.forEach((_, i) => {
      entrySource += `  pluginInit${i}();\n`
    })
    entrySource += `});\n`
  }

  const bundleResult = await esbuild.build({
    stdin: {
      contents: entrySource,
      resolveDir: projectRoot,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    minify: false,
    sourcemap: false,
  })

  const bundledRuntime = new TextDecoder().decode(bundleResult.outputFiles[0]!.contents)

  // Extract title from first heading
  const titleMatch = markdown.match(/^#+\s*\*?\*?(.+?)\*?\*?\s*$/m)
  const title = titleMatch
    ? titleMatch[1]!.replace(/\*\*/g, '').replace(/\s*\{#[\w-]+\}\s*$/, '').trim()
    : 'Compiled Document'

  // Render full page
  const fullHtml = renderPage(title, bodyHtml, clientScripts, bundledRuntime, styleConfig, pluginCss, pluginHeadElements)

  // Determine output path
  const inputDirName = basename(dirname(resolvedInput))
  const outDir = join(projectRoot, 'dist', inputDirName)
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'index.html')
  writeFileSync(outPath, fullHtml, 'utf-8')

  console.log(`Output: ${outPath}`)
  console.log(`Size: ${(fullHtml.length / 1024).toFixed(1)} KB`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
