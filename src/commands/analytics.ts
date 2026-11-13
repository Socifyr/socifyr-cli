import type { Command } from 'commander'
import chalk from 'chalk'
import { createClient } from '../client'
import type { AccountAnalyticsQuery, AnalyticsPeriod } from '@socifyr/sdk'

const PERIODS: AnalyticsPeriod[] = ['last_day', 'last_week', 'last_month', 'last_3months', 'last_year']

interface QueryOpts {
  period?: string
  from?: string
  to?: string
  connection?: string
  platform?: string
  json?: boolean
}

function toQuery(opts: QueryOpts): AccountAnalyticsQuery {
  if (opts.period && !PERIODS.includes(opts.period as AnalyticsPeriod)) {
    console.error(chalk.red(`✗ --period must be one of: ${PERIODS.join(', ')}`))
    process.exit(1)
  }
  return {
    ...(opts.period && { period: opts.period as AnalyticsPeriod }),
    ...(opts.from && { from: opts.from }),
    ...(opts.to && { to: opts.to }),
    ...(opts.connection && { connection: opts.connection }),
    ...(opts.platform && { platform: opts.platform }),
  }
}

export function formatCount(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString('en-US')
}

/** "+120 (+4.2%)" in green, "-30 (-1.1%)" in red, dim when flat. */
export function formatChange(change: number, pct: number | null): string {
  const sign = change > 0 ? '+' : ''
  const pctText = pct === null ? '' : ` (${pct > 0 ? '+' : ''}${pct}%)`
  const text = `${sign}${change.toLocaleString('en-US')}${pctText}`
  if (change > 0) return chalk.green(text)
  if (change < 0) return chalk.red(text)
  return chalk.dim(text)
}

function withQueryOptions(cmd: Command): Command {
  return cmd
    .option('--period <period>', `Window: ${PERIODS.join(' | ')} (default: last 30 days)`)
    .option('--from <date>', 'Start date (ISO 8601)')
    .option('--to <date>', 'End date (ISO 8601)')
    .option('--connection <slug>', 'Only this account (e.g. instagram-mybrand)')
    .option('--platform <platform>', 'Only this platform (e.g. x)')
    .option('--json', 'Output as JSON')
}

function fail(what: string, err: unknown): never {
  console.error(chalk.red(`✗ Failed to fetch ${what}`))
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}

export function registerAnalytics(program: Command) {
  const analytics = program.command('analytics').description('Follower growth and account comparison')

  withQueryOptions(
    analytics.command('followers').description('Follower growth per connected account'),
  ).action(async (opts: QueryOpts) => {
    const client = createClient()
    try {
      const growth = await client.analytics.followers(toQuery(opts))
      if (opts.json) {
        console.log(JSON.stringify(growth, null, 2))
        return
      }

      console.log(
        `\n${chalk.bold('Followers')} ${chalk.dim(`· ${growth.from.slice(0, 10)} → ${growth.to.slice(0, 10)}`)}\n`,
      )
      if (growth.accounts.length === 0) {
        console.log(chalk.dim('  No connected accounts match.\n'))
        return
      }
      for (const a of growth.accounts) {
        const name = (a.slug ?? a.username).padEnd(32)
        if (!a.isTracked) {
          console.log(`  ${name} ${chalk.dim(`not available on ${a.platform}`)}`)
        } else if (a.followers === null) {
          console.log(`  ${name} ${chalk.dim('first snapshot pending (taken daily)')}`)
        } else {
          console.log(`  ${name} ${formatCount(a.followers).padStart(8)}  ${formatChange(a.change, a.changePct)}`)
        }
      }
      console.log(
        `\n  ${chalk.bold('Total'.padEnd(32))} ${formatCount(growth.totals.followers).padStart(8)}  ${formatChange(growth.totals.change, null)}\n`,
      )
    } catch (err) {
      fail('follower growth', err)
    }
  })

  withQueryOptions(
    analytics.command('accounts').description('Compare connected accounts: followers, posts, engagement'),
  ).action(async (opts: QueryOpts) => {
    const client = createClient()
    try {
      const comparison = await client.analytics.accounts(toQuery(opts))
      if (opts.json) {
        console.log(JSON.stringify(comparison, null, 2))
        return
      }

      console.log(
        `\n${chalk.bold('Accounts')} ${chalk.dim(`· ${comparison.from.slice(0, 10)} → ${comparison.to.slice(0, 10)}`)}\n`,
      )
      if (comparison.accounts.length === 0) {
        console.log(chalk.dim('  No connected accounts match.\n'))
        return
      }
      console.log(
        chalk.dim(
          `  ${'Account'.padEnd(32)} ${'Followers'.padStart(9)} ${'Posts'.padStart(6)} ${'Engagement'.padStart(11)} ${'Eng/post'.padStart(9)} ${'Rate'.padStart(7)}`,
        ),
      )
      for (const a of comparison.accounts) {
        console.log(
          `  ${(a.slug ?? a.username).padEnd(32)} ${formatCount(a.followers).padStart(9)} ${String(a.posts).padStart(6)} ${formatCount(a.engagement).padStart(11)} ${String(a.avgEngagementPerPost).padStart(9)} ${`${a.engagementRate}%`.padStart(7)}`,
        )
      }
      console.log(chalk.dim('\n  Rate = engagement ÷ impressions. Use --json for follower change and per-metric totals.\n'))
    } catch (err) {
      fail('account comparison', err)
    }
  })
}
