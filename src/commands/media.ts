import { readFileSync, existsSync } from 'fs'
import { basename } from 'path'
import type { Command } from 'commander'
import chalk from 'chalk'
import { createClient } from '../client'

const TYPE_ICON: Record<string, string> = {
  image: '🖼 ',
  video: '🎬',
  document: '📄',
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function registerMedia(program: Command) {
  const media = program
    .command('media')
    .description('Manage your media library')

  // ── media list ──────────────────────────────────────────────────────────────

  media
    .command('list')
    .description('List media library items')
    .option('--type <type>', 'Filter by type: image, video, document')
    .option('--search <query>', 'Search by filename')
    .option('--limit <n>', 'Max results (default: 20)', '20')
    .option('--json', 'Output as JSON')
    .action(async (opts: { type?: string; search?: string; limit?: string; json?: boolean }) => {
      const client = createClient()
      try {
        const result = await client.media.list({
          type: opts.type as any,
          search: opts.search,
          limit: parseInt(opts.limit ?? '20', 10),
        })

        if (opts.json) { console.log(JSON.stringify(result, null, 2)); return }

        const items: any[] = (result as any).results ?? (result as any).data ?? []
        if (!items || items.length === 0) {
          console.log(chalk.dim('No media found.'))
          return
        }

        const total = (result as any).total ?? items.length
        console.log(`\n${chalk.bold('Media library')} (${total} total)\n`)
        for (const item of items) {
          const icon = TYPE_ICON[item.type] ?? '  '
          console.log(`  ${icon}  ${chalk.bold(item.name)}`)
          console.log(`      ${chalk.dim(`ID: ${item.id}   Size: ${formatBytes(item.sizeBytes)}   ${item.type}`)}`)
          if (item.alt) console.log(`      ${chalk.dim(`Alt: ${item.alt}`)}`)
        }
        console.log()
      } catch (err) {
        console.error(chalk.red('✗ Failed to list media'))
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  // ── media upload ────────────────────────────────────────────────────────────

  media
    .command('upload <file>')
    .description('Upload a file to the media library')
    .option('--alt <text>', 'Alt text / description')
    .option('--json', 'Output as JSON')
    .action(async (file: string, opts: { alt?: string; json?: boolean }) => {
      if (!existsSync(file)) {
        console.error(chalk.red(`✗ File not found: ${file}`))
        process.exit(1)
      }

      const client = createClient()
      try {
        if (!opts.json) process.stderr.write(chalk.dim(`Uploading ${basename(file)}...\n`))
        const item = await client.media.upload(readFileSync(file), basename(file))

        if (opts.alt) {
          await client.media.update(item.id, { alt: opts.alt })
        }

        if (opts.json) { console.log(JSON.stringify(item, null, 2)); return }

        console.log(chalk.green(`✓ Uploaded`))
        console.log(`  ID:   ${chalk.cyan(item.id)}`)
        console.log(`  File: ${chalk.dim(item.name)}`)
        console.log(`  Size: ${chalk.dim(formatBytes(item.sizeBytes))}`)
        console.log(`  URL:  ${chalk.dim(item.url)}`)
      } catch (err) {
        console.error(chalk.red('✗ Upload failed'))
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  // ── media get ───────────────────────────────────────────────────────────────

  media
    .command('get <id>')
    .description('Get details of a media item')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      const client = createClient()
      try {
        const item = await client.media.get(id)

        if (opts.json) { console.log(JSON.stringify(item, null, 2)); return }

        const icon = TYPE_ICON[item.type] ?? '  '
        console.log(`\n${icon}  ${chalk.bold(item.name)}`)
        console.log(`  ID:       ${chalk.cyan(item.id)}`)
        console.log(`  Type:     ${chalk.dim(item.type)}`)
        console.log(`  Size:     ${chalk.dim(formatBytes(item.sizeBytes))}`)
        console.log(`  URL:      ${chalk.dim(item.url)}`)
        if (item.alt) console.log(`  Alt:      ${chalk.dim(item.alt)}`)
        if (item.description) console.log(`  Desc:     ${chalk.dim(item.description)}`)
        if (item.tags?.length) console.log(`  Tags:     ${chalk.dim(item.tags.join(', '))}`)
        console.log()
      } catch (err) {
        console.error(chalk.red('✗ Failed to get media'))
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  // ── media delete ────────────────────────────────────────────────────────────

  media
    .command('delete <ids...>')
    .description('Delete one or more media items')
    .option('--json', 'Output as JSON')
    .action(async (ids: string[], opts: { json?: boolean }) => {
      const client = createClient()
      try {
        if (ids.length === 1) {
          await client.media.delete(ids[0])
        } else {
          await client.media.bulkDelete(ids)
        }

        if (opts.json) { console.log(JSON.stringify({ deleted: ids })); return }

        console.log(chalk.green(`✓ Deleted ${ids.length} item${ids.length === 1 ? '' : 's'}`))
      } catch (err) {
        console.error(chalk.red('✗ Delete failed'))
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
