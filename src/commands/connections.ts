import type { Command } from 'commander'
import chalk from 'chalk'
import { createClient } from '../client'

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  facebook: '👥',
  twitter: '🐦',
  x: '✕ ',
  linkedin: '💼',
  tiktok: '🎵',
  youtube: '▶️ ',
  pinterest: '📌',
  reddit: '🔴',
  bluesky: '🦋',
  threads: '🧵',
  mastodon: '🐘',
}

export function registerConnections(program: Command) {
  const connections = program
    .command('connections')
    .alias('conn')
    .description('List connected social accounts')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const client = createClient()

      try {
        const connections = await client.workspaces.listConnections()
        const active = connections.filter((c) => !c.disconnectedAt)

        if (opts.json) {
          console.log(JSON.stringify(active, null, 2))
          return
        }

        if (active.length === 0) {
          console.log(chalk.yellow('No connected accounts found.'))
          console.log(`Connect accounts at ${chalk.underline('https://app.socifyr.com/dashboard/accounts')}`)
          return
        }

        console.log(chalk.bold(`\n${active.length} connected account${active.length === 1 ? '' : 's'}:\n`))

        for (const c of active) {
          const icon = PLATFORM_ICONS[c.platform] ?? '🔗'
          const name = c.targetName ?? c.platformUsername
          const expiry = c.expiresAt ? new Date(c.expiresAt) : null
          const isExpiringSoon = expiry && expiry.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000

          console.log(`  ${icon}  ${chalk.bold(c.slug)}`)
          console.log(`      ${chalk.dim(c.platform)} · ${name}`)
          if (c.status === 'needs_reconnect') {
            console.log(`      ${chalk.red(`✗ Needs reconnect — run: socifyr connections reconnect ${c.slug}`)}`)
          } else if (c.status === 'expiring' && c.canRefresh) {
            console.log(`      ${chalk.yellow(`⚠ Expiring — run: socifyr connections refresh ${c.slug}`)}`)
          } else if (isExpiringSoon && c.status !== 'active') {
            console.log(`      ${chalk.yellow(`⚠ Token expires ${expiry!.toLocaleDateString()}`)}`)
          }
        }

        console.log()
        console.log(chalk.dim('Use slugs with: socifyr post "text" --to <slug1,slug2>'))
      } catch (err) {
        console.error(chalk.red('✗ Failed to fetch connections'))
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  connections
    .command('refresh <slug>')
    .description('Renew an account token without re-authorizing (when it supports refresh)')
    .action(async (slug: string) => {
      const client = createClient()
      try {
        const r = await client.workspaces.refreshConnection(slug)
        console.log(chalk.green(`✓ Refreshed ${r.slug ?? slug}`) + chalk.dim(` · status: ${r.status}`))
      } catch (err) {
        console.error(chalk.red(`✗ Could not refresh ${slug}`))
        console.error(err instanceof Error ? err.message : String(err))
        console.error(chalk.dim(`Try: socifyr connections reconnect ${slug}`))
        process.exit(1)
      }
    })

  connections
    .command('reconnect <slug>')
    .description('Get a one-time link to re-authorize an account (no dashboard needed)')
    .option('--json', 'Output as JSON')
    .action(async (slug: string, opts: { json?: boolean }) => {
      const client = createClient()
      try {
        const link = await client.workspaces.getReconnectLink(slug)
        if (opts.json) {
          console.log(JSON.stringify(link, null, 2))
          return
        }
        console.log(chalk.bold(`\nReconnect ${link.slug ?? slug} (${link.platform})`))
        console.log(`Open this link in a browser and approve access:\n\n  ${chalk.underline(link.url)}\n`)
        console.log(chalk.dim(`Sign in with the same account. Works once; expires in ${Math.round(link.expiresIn / 60)} minutes. Your slug and scheduled posts are kept.`))
      } catch (err) {
        console.error(chalk.red(`✗ Could not create a reconnect link for ${slug}`))
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
