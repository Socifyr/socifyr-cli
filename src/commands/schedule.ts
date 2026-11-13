import { readFileSync, existsSync } from 'fs'
import type { Command } from 'commander'
import chalk from 'chalk'
import { createClient } from '../client'

export function registerSchedule(program: Command) {
  program
    .command('schedule <file.csv>')
    .description('Bulk-schedule text posts from a CSV (text,connections,scheduledAt,title)')
    .option('--json', 'Output as JSON')
    .action(async (file: string, opts: { json?: boolean }) => {
      if (!existsSync(file)) {
        console.error(chalk.red(`✗ File not found: ${file}`))
        process.exit(1)
      }

      const csv = readFileSync(file, 'utf8')
      const client = createClient()

      try {
        if (!opts.json) process.stderr.write(chalk.dim('Scheduling posts…\n'))
        const res = await client.uploads.bulkSchedule({ csv })

        if (opts.json) {
          console.log(JSON.stringify(res, null, 2))
          return
        }

        console.log(
          `\n${chalk.green(`✓ ${res.created} scheduled`)}` +
            (res.failed.length ? chalk.red(` · ${res.failed.length} failed`) : ''),
        )
        for (const f of res.failed) {
          console.log(`  ${chalk.red(`Row ${f.row}`)}: ${f.error}`)
        }
        console.log()
      } catch (err) {
        console.error(chalk.red('✗ Bulk schedule failed'))
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
