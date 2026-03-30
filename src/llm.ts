import OpenAI from 'openai'
import { createHash } from 'crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const CACHE_DIR = join(process.cwd(), '.cache', 'llm')

export interface LLMConfig {
  apiKey: string
  baseURL: string
  model: string
}

let client: OpenAI | null = null
let config: LLMConfig | null = null

export function initLLM(cfg: LLMConfig): void {
  config = cfg
  client = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
  })
  mkdirSync(CACHE_DIR, { recursive: true })
}

function cacheKey(systemPrompt: string, userContent: string): string {
  const hash = createHash('sha256')
    .update(systemPrompt)
    .update(userContent)
    .update(config!.model)
    .digest('hex')
  return join(CACHE_DIR, `${hash}.txt`)
}

export async function callLLM(
  systemPrompt: string,
  userContent: string,
  noCache = false,
): Promise<string> {
  if (!client || !config) {
    throw new Error('LLM not initialized. Set LLM_API_KEY, LLM_BASE_URL, and LLM_MODEL env vars.')
  }

  const cachePath = cacheKey(systemPrompt, userContent)

  if (!noCache && existsSync(cachePath)) {
    console.log('  [cache hit]')
    return readFileSync(cachePath, 'utf-8')
  }

  console.log(`  [calling ${config.model}...]`)

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.2,
  })

  const result = response.choices[0]?.message?.content ?? ''
  writeFileSync(cachePath, result, 'utf-8')
  return result
}

export function isLLMConfigured(): boolean {
  return client !== null && config !== null
}
