import { program } from 'commander'
import { registerConfigure } from './commands/configure'
import { registerConnections } from './commands/connections'
import { registerPost } from './commands/post'
import { registerStatus } from './commands/status'
import { registerManage } from './commands/manage'
import { registerMedia } from './commands/media'
import { registerUsage } from './commands/usage'
import { registerSchedule } from './commands/schedule'
import { registerAnalytics } from './commands/analytics'

program
  .name('socifyr')
  .description('Post to 18 social platforms from your terminal')
  .version('0.3.0')
  .addHelpText('after', `
Examples:
  $ socifyr configure --key sk_...
  $ socifyr connections
  $ socifyr usage
  $ socifyr analytics followers --period last_3months
  $ socifyr analytics accounts --json
  $ socifyr schedule posts.csv
  $ socifyr post "Just shipped v2.0 🚀" --to twitter-me,linkedin-me
  $ socifyr post --file CHANGELOG.md --to linkedin-me --ai
  $ socifyr post "Deploy complete" --to twitter-me --at "2026-06-01T09:00"
  $ cat release-notes.md | socifyr post --to linkedin-me --wait
  $ socifyr status <post-id>
  $ socifyr retry <post-id> --wait
  $ socifyr publish <draft-id>
  $ socifyr media list --type image
  $ socifyr media upload banner.png --alt "Product banner"
  $ socifyr media delete <media-id>

Env vars (override stored config):
  SOCIFYR_API_KEY        Your API key (it selects the workspace)
  SOCIFYR_API_URL        Custom API URL (self-hosted)
`)

registerConfigure(program)
registerConnections(program)
registerPost(program)
registerStatus(program)
registerManage(program)
registerMedia(program)
registerUsage(program)
registerSchedule(program)
registerAnalytics(program)

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
