import type { Command } from 'commander'
import chalk from 'chalk'
import { createClient } from '../client'
import type { UsageDimension } from '@socifyr/sdk'

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576) return `${Math.round(bytes / 1_048_576)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/** Renders "used / limit" with a colour that warns as the cap approaches. */
function renderLine(
  label: string,
  dim: UsageDimension,
  format: (n: number) => string = (n) => String(n),
): string {
  if (dim.unlimited) {
    return `  ${chalk.bold(label.padEnd(10))} ${format(dim.used)} ${chalk.dim('/ ∞')}`
  }
  const limit = dim.limit ?? 0
  const ratio = limit > 0 ? dim.used / limit : 0
  const color = ratio >= 1 ? chalk.red : ratio >= 0.8 ? chalk.yellow : chalk.green
  return `  ${chalk.bold(label.padEnd(10))} ${color(`${format(dim.used)} / ${format(limit)}`)}`
}

export function registerUsage(program: Command) {
  program
    .command('usage')
    .description('Show current usage vs your plan limits')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const client = createClient()

      try {
        const usage = await client.workspaces.usage()

        if (opts.json) {
          console.log(JSON.stringify(usage, null, 2))
          return
        }

        console.log(`\n${chalk.bold('Usage')} ${chalk.dim(`· ${usage.tier} plan`)}\n`)
        console.log(renderLine('Posts', usage.uploads))
        console.log(chalk.dim('             (this month)'))
        console.log(renderLine('X posts', usage.xPosts))
        console.log(
          chalk.dim(`             (this month · X bills per post · ~$${usage.xSpendUsd.toFixed(2)} spent)`),
        )
        if (usage.scheduledPosts) {
          console.log(renderLine('Scheduled', usage.scheduledPosts))
          console.log(chalk.dim('             (this month · counted inside Posts)'))
        }
        console.log(renderLine('Accounts', usage.accounts))
        console.log(
          renderLine('Storage', usage.storage, formatBytes),
        )
        console.log()
      } catch (err) {
        console.error(chalk.red('✗ Failed to fetch usage'))
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
