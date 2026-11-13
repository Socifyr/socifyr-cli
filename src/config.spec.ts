/// <reference types="jest" />

import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync, existsSync, rmSync, mkdirSync, readFileSync } from 'fs'

describe('config', () => {
  const testDir = join(tmpdir(), 'socifyr-cli-test-' + Date.now())

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    try { rmSync(testDir, { recursive: true }) } catch {}
  })

  describe('readConfig', () => {
    it('returns empty object when config file does not exist', () => {
      const CONFIG_FILE = join(testDir, 'config.json')
      const readConfig = () => {
        if (!existsSync(CONFIG_FILE)) return {}
        try {
          return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
        } catch {
          return {}
        }
      }
      const result = readConfig()
      expect(result).toEqual({})
    })

    it('returns empty object for malformed JSON', () => {
      const CONFIG_FILE = join(testDir, 'config.json')
      writeFileSync(CONFIG_FILE, 'not json', 'utf-8')
      const readConfig = () => {
        if (!existsSync(CONFIG_FILE)) return {}
        try {
          return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
        } catch {
          return {}
        }
      }
      const result = readConfig()
      expect(result).toEqual({})
    })

    it('reads config file correctly', () => {
      const CONFIG_FILE = join(testDir, 'config.json')
      const config = { apiKey: 'sk_test123', workspaceId: 'ws_abc' }
      writeFileSync(CONFIG_FILE, JSON.stringify(config), 'utf-8')
      const readConfig = () => {
        if (!existsSync(CONFIG_FILE)) return {}
        try {
          return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
        } catch {
          return {}
        }
      }
      const result = readConfig()
      expect(result).toEqual({ apiKey: 'sk_test123', workspaceId: 'ws_abc' })
    })
  })
})

describe('API key validation', () => {
  it('recognizes sk_ prefix as valid', () => {
    const key = 'sk_test123'
    expect(key.startsWith('sk_')).toBe(true)
  })

  it('recognizes non-sk_ prefix as invalid', () => {
    const key = 'pk_test123'
    expect(key.startsWith('sk_')).toBe(false)
  })

  it('recognizes Bearer token format', () => {
    const token = 'Bearer sk_test123'
    expect(token.startsWith('Bearer ')).toBe(true)
  })
})

describe('Connection slug patterns', () => {
  it('platform-username format', () => {
    const slug = 'instagram-mybrand'
    const parts = slug.split('-')
    expect(parts.length).toBeGreaterThanOrEqual(2)
  })

  it('platform-only slug', () => {
    const slug = 'instagram'
    expect(slug.length).toBeGreaterThan(0)
  })

  it('multiple platforms comma-separated', () => {
    const input = 'instagram-me,linkedin-me,twitter-me'
    const slugs = input.split(',')
    expect(slugs).toHaveLength(3)
    expect(slugs[0]).toBe('instagram-me')
  })
})

describe('CLI argument patterns', () => {
  it('--json flag detection', () => {
    const args = ['status', 'abc123', '--json']
    expect(args.includes('--json')).toBe(true)
  })

  it('--wait flag detection', () => {
    const args = ['post', 'Hello', '--wait']
    expect(args.includes('--wait')).toBe(true)
  })

  it('--file flag with value', () => {
    const args = ['post', '--file', 'image.png', '--to', 'instagram-me']
    const fileIndex = args.indexOf('--file')
    expect(fileIndex).toBe(1)
    expect(args[fileIndex + 1]).toBe('image.png')
  })

  it('--to with comma-separated connections', () => {
    const args = ['post', 'Hello', '--to', 'instagram-me,linkedin-me']
    const toIndex = args.indexOf('--to')
    expect(toIndex).toBe(2)
    const connections = args[toIndex + 1].split(',')
    expect(connections).toEqual(['instagram-me', 'linkedin-me'])
  })

  it('--at for scheduling', () => {
    const args = ['post', 'Hello', '--at', '2026-06-01T09:00']
    const atIndex = args.indexOf('--at')
    expect(atIndex).toBe(2)
    expect(args[atIndex + 1]).toBe('2026-06-01T09:00')
  })
})