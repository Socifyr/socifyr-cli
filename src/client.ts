import { Socifyr } from '@socifyr/sdk'
import chalk from 'chalk'
import { resolveApiKey, resolveApiUrl } from './config'

export function createClient(): Socifyr {
  const apiKey = resolveApiKey()
  const apiUrl = resolveApiUrl()

  if (!apiKey) {
    console.error(chalk.red('✗ No API key configured.'))
    console.error(
      `  Run ${chalk.cyan('socifyr configure --key sk_...')} or set ${chalk.cyan('SOCIFYR_API_KEY')}`,
    )
    console.error(
      `  Get an API key at ${chalk.underline('https://app.socifyr.com/dashboard/integrations#api-keys')}`,
    )
    process.exit(1)
  }

  return new Socifyr({ apiKey, apiUrl })
}
