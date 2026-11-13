jest.mock('../client', () => ({ createClient: jest.fn() }))

import { formatChange, formatCount } from './analytics'

// Strip ANSI colour codes so assertions don't depend on the terminal.
const plain = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')

describe('analytics formatting', () => {
  it('formats follower counts compactly', () => {
    expect(formatCount(null)).toBe('—')
    expect(formatCount(0)).toBe('0')
    expect(formatCount(9_999)).toBe('9,999')
    expect(formatCount(12_345)).toBe('12.3k')
    expect(formatCount(2_500_000)).toBe('2.5M')
  })

  it('signs changes and appends the percent when known', () => {
    expect(plain(formatChange(120, 4.2))).toBe('+120 (+4.2%)')
    expect(plain(formatChange(-30, -1.1))).toBe('-30 (-1.1%)')
    expect(plain(formatChange(0, 0))).toBe('0 (0%)')
    expect(plain(formatChange(1500, null))).toBe('+1,500')
  })
})
