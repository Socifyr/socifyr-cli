import type { Command } from 'commander'
import chalk from 'chalk'
import { readConfig, writeConfig, resolveApiKey } from '../config'

export function registerConfigure(program: Command) {
  program
    .command('configure')
    .description('Save your API key (it already belongs to one workspace)')
    .option('-k, --key <key>', 'API key (sk_...)')
    .option('--api-url <url>', 'API base URL (for self-hosted)')
    .option('--show', 'Print current configuration')
    .action((opts: { key?: string; apiUrl?: string; show?: boolean }) => {
      if (opts.show) {
        const key = resolveApiKey()
        console.log(chalk.bold('Current configuration:'))
        console.log(
          `  API key:    ${key ? chalk.green(key.slice(0, 10) + '...') : chalk.dim('not set')}`,
        )
        const config = readConfig()
        if (config.apiUrl) console.log(`  API URL:    ${chalk.green(config.apiUrl)}`)
        return
      }

      if (!opts.key && !opts.apiUrl) {
        console.log(chalk.yellow('Usage:'))
        console.log(`  socifyr configure --key sk_...`)
        console.log(
          `\nCreate an API key at ${chalk.underline('https://app.socifyr.com/dashboard/integrations#api-keys')}. It posts to the workspace it was created in.`,
        )
        return
      }

      const patch: Record<string, string> = {}
      if (opts.key) patch.apiKey = opts.key
      if (opts.apiUrl) patch.apiUrl = opts.apiUrl

      writeConfig(patch)
      console.log(chalk.green('✓ Configuration saved'))
      if (opts.key) console.log(`  API key: ${chalk.dim(opts.key.slice(0, 10) + '...')}`)
    })
}
