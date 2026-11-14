import { homedir } from 'os'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'

interface StoredConfig {
  apiKey?: string
  apiUrl?: string
}

const CONFIG_DIR = join(homedir(), '.socifyr')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

export function readConfig(): StoredConfig {
  if (!existsSync(CONFIG_FILE)) return {}
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as StoredConfig
  } catch {
    return {}
  }
}

export function writeConfig(patch: StoredConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  const current = readConfig()
  writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...patch }, null, 2), 'utf-8')
}

export function resolveApiKey(): string | undefined {
  return process.env.SOCIFYR_API_KEY || readConfig().apiKey
}

export function resolveApiUrl(): string {
  return process.env.SOCIFYR_API_URL || readConfig().apiUrl || 'https://api.socifyr.com/api'
}
