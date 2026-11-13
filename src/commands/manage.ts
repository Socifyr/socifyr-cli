import type { Command } from 'commander'
import type { UpdateDraftParams } from '@socifyr/sdk'
import chalk from 'chalk'
import { createClient } from '../client'

function splitList(raw?: string): string[] | undefined {
  if (!raw) return undefined
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return items.length ? items : undefined
}

export function registerManage(program: Command) {
  program
    .command('retry <id>')
    .description('Retry failed channels for a post')
    .option('--json', 'Output as JSON')
    .option('-w, --wait', 'Wait for completion and show results')
    .action(async (id: string, opts: { json?: boolean; wait?: boolean }) => {
      const client = createClient()

      try {
        if (!opts.json) process.stderr.write(chalk.dim('Retrying failed channels...\n'))
        const upload = await client.uploads.retry(id)

        if (opts.wait) {
          if (!opts.json) process.stderr.write(chalk.dim('Waiting for results...\n'))
          const result = await client.uploads.waitForCompletion(id)
          if (opts.json) { console.log(JSON.stringify(result, null, 2)); return }

          console.log(`\nPost ${chalk.bold(id)}`)
          console.log(`Status: ${chalk.green(result.status)}\n`)
          for (const ch of result.channels ?? []) {
            const r = ch.result
            const icon = r?.status === 'success' ? chalk.green('✓') :
                         r?.status === 'failed' ? chalk.red('✗') : chalk.dim('·')
            const link = r?.postUrl ? chalk.dim(` → ${r.postUrl}`) : ''
            console.log(`  ${icon}  ${chalk.bold(ch.platform)}${link}`)
            if (r?.error) console.log(`      ${chalk.red(r.error)}`)
          }
          console.log()
          return
        }

        if (opts.json) { console.log(JSON.stringify(upload, null, 2)); return }
        console.log(chalk.green('✓ Retry queued'))
        console.log(`  ID: ${chalk.dim(upload.id)}`)
        console.log(`  Check status: ${chalk.cyan(`socifyr status ${upload.id}`)}`)
      } catch (err) {
        console.error(chalk.red('✗ Failed to retry'))
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  program
    .command('publish <id>')
    .description('Publish a saved draft')
    .option('--json', 'Output as JSON')
    .option('-w, --wait', 'Wait for completion and show results')
    .action(async (id: string, opts: { json?: boolean; wait?: boolean }) => {
      const client = createClient()

      try {
        if (!opts.json) process.stderr.write(chalk.dim('Publishing draft...\n'))
        const upload = await client.uploads.publishDraft(id)

        if (opts.wait) {
          if (!opts.json) process.stderr.write(chalk.dim('Waiting for results...\n'))
          // publishDraft's ack is async-only (no uploadId) — poll with the
          // draft ID the user passed; getStatus accepts it.
          const result = await client.uploads.waitForCompletion(id)
          if (opts.json) { console.log(JSON.stringify(result, null, 2)); return }

          console.log(`\nPost ${chalk.bold(id)}`)
          console.log(`Status: ${chalk.green(result.status)}\n`)
          for (const ch of result.channels ?? []) {
            const r = ch.result
            const icon = r?.status === 'success' ? chalk.green('✓') :
                         r?.status === 'failed' ? chalk.red('✗') : chalk.dim('·')
            const link = r?.postUrl ? chalk.dim(` → ${r.postUrl}`) : ''
            console.log(`  ${icon}  ${chalk.bold(ch.platform)}${link}`)
            if (r?.error) console.log(`      ${chalk.red(r.error)}`)
          }
          console.log()
          return
        }

        if (opts.json) { console.log(JSON.stringify(upload, null, 2)); return }
        console.log(chalk.green('✓ Draft published'))
        console.log(`  ID: ${chalk.dim(upload.id)}`)
        console.log(`  Check status: ${chalk.cyan(`socifyr status ${upload.id}`)}`)
      } catch (err) {
        console.error(chalk.red('✗ Failed to publish draft'))
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  program
    .command('edit <id>')
    .description('Edit a draft or scheduled post (text, schedule, or target accounts)')
    .option('--text <text>', 'New caption/body text')
    .option('--title <title>', 'New title')
    .option(
      '-t, --to <connections>',
      'Comma-separated connection slugs — the FULL set to post to (replaces the current accounts)',
    )
    .option('--at <iso>', 'New schedule time (ISO 8601). For a scheduled post, must be in the future.')
    .option('--media-id <refs>', 'Comma-separated media library IDs (replaces current media)')
    .option('--format <contentFormat>', 'Content format override (e.g. short_video, photo_carousel)')
    .option('--json', 'Output as JSON')
    .addHelpText(
      'after',
      `\nExamples:\n  $ socifyr edit 6a05032a --to instagram-me,x-me\n  $ socifyr edit 6a05032a --text "Updated caption" --at 2026-12-01T09:00:00Z\n`,
    )
    .action(
      async (
        id: string,
        opts: {
          text?: string
          title?: string
          to?: string
          at?: string
          mediaId?: string
          format?: string
          json?: boolean
        },
      ) => {
        const params: UpdateDraftParams = {}
        if (opts.text !== undefined) params.text = opts.text
        if (opts.title !== undefined) params.title = opts.title
        const connections = splitList(opts.to)
        if (connections) params.connections = connections
        if (opts.at) params.scheduledAt = opts.at
        const mediaIds = splitList(opts.mediaId)
        if (mediaIds) params.mediaIds = mediaIds
        if (opts.format) params.contentFormat = opts.format

        if (Object.keys(params).length === 0) {
          console.error(
            chalk.red('✗ Nothing to update. Pass --text, --title, --to, --at, --media-id, or --format.'),
          )
          process.exit(1)
        }

        const client = createClient()
        try {
          if (!opts.json) process.stderr.write(chalk.dim('Updating post...\n'))
          const upload = await client.uploads.update(id, params)

          if (opts.json) {
            console.log(JSON.stringify(upload, null, 2))
            return
          }
          console.log(chalk.green('✓ Post updated'))
          console.log(`  ID: ${chalk.dim(upload.id ?? id)}`)
          if (params.connections)
            console.log(`  Connections: ${chalk.dim(params.connections.join(', '))}`)
          if (params.scheduledAt)
            console.log(`  Scheduled: ${chalk.dim(new Date(params.scheduledAt).toLocaleString())}`)
          console.log(`  Check status: ${chalk.cyan(`socifyr status ${id}`)}`)
        } catch (err) {
          console.error(chalk.red('✗ Failed to update post'))
          console.error(err instanceof Error ? err.message : String(err))
          process.exit(1)
        }
      },
    )
}
