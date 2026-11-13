import type { Command } from 'commander'
import chalk from 'chalk'
import { createClient } from '../client'

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return chalk.green(status)
    case 'failed': return chalk.red(status)
    case 'partial_failure': return chalk.yellow(status)
    case 'processing':
    case 'publishing': return chalk.blue(status)
    default: return chalk.dim(status)
  }
}

export function registerStatus(program: Command) {
  program
    .command('status <id>')
    .description('Check the status of a post')
    .option('--json', 'Output as JSON')
    .option('-w, --wait', 'Poll until complete')
    .action(async (id: string, opts: { json?: boolean; wait?: boolean }) => {
      const client = createClient()

      try {
        const result = opts.wait
          ? await client.uploads.waitForCompletion(id)
          : await client.uploads.getStatus(id)

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2))
          return
        }

        console.log(`\nPost ${chalk.bold(id)}`)
        console.log(`Status: ${statusColor(result.status)}\n`)

        for (const ch of result.channels ?? []) {
          const r = ch.result
          const icon = r?.status === 'success' ? chalk.green('✓') :
                       r?.status === 'failed' ? chalk.red('✗') : chalk.dim('·')
          const link = r?.postUrl ? chalk.dim(` → ${r.postUrl}`) : ''
          console.log(`  ${icon}  ${chalk.bold(ch.platform)}${link}`)
          if (r?.error) console.log(`      ${chalk.red(r.error)}`)
        }
        console.log()
      } catch (err) {
        console.error(chalk.red('✗ Failed to fetch status'))
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
