import { readFileSync, existsSync } from 'fs'
import { basename, extname } from 'path'
import type { Command } from 'commander'
import chalk from 'chalk'
import type { UploadStatusResponse } from '@socifyr/sdk'
import { createClient } from '../client'

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic'])
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'])

function parseConnections(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function parseMediaPaths(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

function detectMediaType(paths: string[]): 'photo' | 'video' | null {
  if (paths.length === 0) return null
  const ext = extname(paths[0]).toLowerCase()
  if (IMAGE_EXTS.has(ext)) return 'photo'
  if (VIDEO_EXTS.has(ext)) return 'video'
  return null
}

function formatStatus(status: string): string {
  switch (status) {
    case 'completed': return chalk.green('✓ published')
    case 'failed': return chalk.red('✗ failed')
    case 'partial_failure': return chalk.yellow('⚠ partial failure')
    case 'processing': return chalk.blue('⟳ processing')
    case 'publishing': return chalk.blue('⟳ publishing')
    default: return chalk.dim(status)
  }
}

function printResult(result: UploadStatusResponse) {
  console.log(`\n${formatStatus(result.status)}\n`)
  for (const ch of result.channels ?? []) {
    const r = ch.result
    const icon = r?.status === 'success' ? chalk.green('✓') : chalk.red('✗')
    const link = r?.postUrl ? chalk.dim(` → ${r.postUrl}`) : ''
    console.log(`  ${icon}  ${chalk.bold(ch.platform)}${link}`)
    if (r?.error) console.log(`      ${chalk.red(r.error)}`)
  }
  console.log()
}

const VALID_FORMATS = ['short_video', 'story', 'feed_video', 'photo_single', 'photo_carousel', 'text_post', 'document_post']

export function registerPost(program: Command) {
  program
    .command('post [text]')
    .description('Post to social platforms — text, images, or video')
    .option('-t, --to <connections>', 'Comma-separated connection slugs (e.g. twitter-me,linkedin-me)')
    .option('-f, --file <path>', 'Read caption from a text file')
    .option('-m, --media <paths>', 'Comma-separated local file paths (auto-detects image vs video)')
    .option('--media-id <refs>', 'Comma-separated media library IDs or public URLs (no upload needed)')
    .option('--format <format>', `Content format: ${VALID_FORMATS.join(', ')}`)
    .option('-a, --at <datetime>', 'Schedule for a specific time (ISO 8601)')
    .option('--ai', 'Use AI to generate platform-specific captions')
    .option('-w, --wait', 'Wait for completion and show per-platform results')
    .option('--json', 'Output as JSON')
    .option('--draft', 'Save as draft without publishing')
    .addHelpText('after', `
Media examples:
  $ socifyr post "Check this out!" --media photo.jpg --to instagram-me
  $ socifyr post --media video.mp4 --to tiktok-me,instagram-me --ai --wait
  $ socifyr post "New product" --media img1.jpg,img2.jpg --to instagram-me
  $ socifyr post "Reuse library asset" --media-id 6a04f715d3d7d93575e65d13 --to instagram-me
  $ socifyr post "From URL" --media-id https://example.com/banner.jpg --to linkedin-me
  $ socifyr post "Reel" --media video.mp4 --format short_video --to instagram-me
`)
    .action(async (
      text: string | undefined,
      opts: {
        to?: string
        file?: string
        media?: string
        mediaId?: string
        format?: string
        at?: string
        ai?: boolean
        wait?: boolean
        json?: boolean
        draft?: boolean
      },
    ) => {
      // ── Resolve caption ──────────────────────────────────────────────────
      let caption = text ?? ''

      if (opts.file) {
        if (!existsSync(opts.file)) {
          console.error(chalk.red(`✗ File not found: ${opts.file}`))
          process.exit(1)
        }
        caption = readFileSync(opts.file, 'utf-8').trim()
      }

      if (!caption && !process.stdin.isTTY) {
        caption = readFileSync('/dev/stdin', 'utf-8').trim()
      }

      // ── Resolve media ────────────────────────────────────────────────────
      const mediaPaths = opts.media ? parseMediaPaths(opts.media) : []
      const mediaType = detectMediaType(mediaPaths)

      if (mediaPaths.length > 0) {
        for (const p of mediaPaths) {
          if (!existsSync(p)) {
            console.error(chalk.red(`✗ Media file not found: ${p}`))
            process.exit(1)
          }
        }
        if (!mediaType) {
          console.error(chalk.red(`✗ Unrecognized media type: ${extname(mediaPaths[0])}`))
          console.error(`  Supported: ${[...IMAGE_EXTS, ...VIDEO_EXTS].join(', ')}`)
          process.exit(1)
        }
      }

      // ── Resolve media IDs / URLs ─────────────────────────────────────────
      const mediaIdRefs = opts.mediaId ? parseMediaPaths(opts.mediaId) : []
      const client = createClient()

      // Determine effective media type across local files + ID refs.
      // Local files and URLs classify by extension; bare library IDs are
      // resolved via the media library so a video ID is never submitted as a photo.
      let effectiveMediaType: 'photo' | 'video' | 'document' | null = mediaType
      if (effectiveMediaType === null && mediaIdRefs.length > 0) {
        const isUrlRef = (ref: string) => ref.startsWith('http://') || ref.startsWith('https://')
        let libraryTypes: string[] = []
        try {
          libraryTypes = await Promise.all(
            mediaIdRefs
              .filter((ref) => !isUrlRef(ref))
              .map(async (id) => (await client.media.get(id)).type),
          )
        } catch (err) {
          console.error(chalk.red('✗ Failed to resolve media library ID'))
          console.error(err instanceof Error ? err.message : String(err))
          process.exit(1)
        }
        const hasVideoRef =
          libraryTypes.includes('video') ||
          mediaIdRefs.some(
            (ref) => isUrlRef(ref) && VIDEO_EXTS.has(extname(ref.split('?')[0]).toLowerCase()),
          )
        effectiveMediaType = hasVideoRef
          ? 'video'
          : libraryTypes.includes('document')
            ? 'document'
            : 'photo'
      }

      if (effectiveMediaType === 'video' && (mediaPaths.length + mediaIdRefs.length) > 1) {
        console.error(chalk.red('✗ Only one video file can be posted at a time'))
        process.exit(1)
      }

      // ── Validate format ──────────────────────────────────────────────────
      if (opts.format && !VALID_FORMATS.includes(opts.format)) {
        console.error(chalk.red(`✗ Invalid format: ${opts.format}`))
        console.error(`  Valid formats: ${VALID_FORMATS.join(', ')}`)
        process.exit(1)
      }

      if (!caption && !opts.ai && mediaPaths.length === 0 && mediaIdRefs.length === 0) {
        console.error(chalk.red('✗ No content provided.'))
        console.error('  Pass text inline, use --file, --media, --media-id, or pipe via stdin.')
        process.exit(1)
      }

      if (!opts.to) {
        console.error(chalk.red('✗ No connections specified.'))
        console.error(`  Use ${chalk.cyan('socifyr connections')} to see available slugs`)
        process.exit(1)
      }

      const connections = parseConnections(opts.to)

      try {
        // ── AI caption generation ────────────────────────────────────────
        if (opts.ai) {
          if (!opts.json) process.stderr.write(chalk.dim('Generating AI captions...\n'))
          const uploadType = effectiveMediaType ?? 'text'
          // Derive platforms from connection slugs (prefix before "-")
          const platforms = Array.from(new Set(
            connections.map((c) => c.split('-')[0]).filter(Boolean)
          )) as unknown as Parameters<typeof client.ai.generateContent>[0]['platforms']
          const generated = await client.ai.generateContent({
            uploadType,
            platforms,
            description: caption || undefined,
          })
          const firstCaption = Object.values(generated.content ?? {})[0]
          caption = firstCaption ?? caption
        }

        const action = opts.draft ? 'Saving draft' : opts.at ? `Scheduling for ${opts.at}` : 'Publishing'
        if (!opts.json) {
          const totalMediaCount = mediaPaths.length + mediaIdRefs.length
          const typeLabel = effectiveMediaType === 'video'
            ? 'video'
            : effectiveMediaType === 'document'
              ? `${totalMediaCount} document${totalMediaCount > 1 ? 's' : ''}`
              : effectiveMediaType === 'photo'
                ? `${totalMediaCount} image${totalMediaCount > 1 ? 's' : ''}`
                : 'text post'
          process.stderr.write(chalk.dim(`${action} ${typeLabel} to ${connections.length} account${connections.length === 1 ? '' : 's'}...\n`))
        }

        // ── Submit ───────────────────────────────────────────────────────
        const baseParams = {
          connections,
          text: caption || undefined,
          scheduledAt: opts.at,
          saveDraft: opts.draft,
          ...(opts.format ? { contentFormat: opts.format } : {}),
        }

        // Upload local files to media library first (preserving original filename),
        // then combine with media library IDs / URLs as a single ref list.
        const uploadedIds: string[] = []
        for (const p of mediaPaths) {
          if (!opts.json) {
            process.stderr.write(chalk.dim(`Uploading ${basename(p)}...\n`))
          }
          const item = await client.media.upload(readFileSync(p), basename(p))
          uploadedIds.push(item.id)
        }
        const allMedias: string[] = [...uploadedIds, ...mediaIdRefs]

        let upload
        if (effectiveMediaType === 'video') {
          upload = await client.uploads.video({
            ...baseParams,
            medias: [allMedias[0]],
          })
        } else if (effectiveMediaType === 'document') {
          upload = await client.uploads.document({
            ...baseParams,
            medias: allMedias,
          })
        } else if (effectiveMediaType === 'photo') {
          upload = await client.uploads.photos({
            ...baseParams,
            medias: allMedias,
          })
        } else {
          if (!caption) {
            console.error(chalk.red('✗ Text post requires non-empty content.'))
            process.exit(1)
          }
          upload = await client.uploads.text({ ...baseParams, text: caption })
        }

        // ── Wait for result ──────────────────────────────────────────────
        if (opts.wait && !opts.draft) {
          if (!opts.json) process.stderr.write(chalk.dim('Waiting for results...\n'))
          const result = await client.uploads.waitForCompletion(upload.id!)
          if (opts.json) { console.log(JSON.stringify(result, null, 2)); return }
          printResult(result)
          return
        }

        if (opts.json) { console.log(JSON.stringify(upload, null, 2)); return }

        const postId = upload.id
        const actionLabel = opts.draft ? 'Draft saved' : opts.at ? 'Scheduled' : 'Post submitted'
        console.log(chalk.green(`✓ ${actionLabel}`))
        console.log(`  ID: ${chalk.dim(postId)}`)
        if (!opts.draft && !opts.at) {
          console.log(`  Check status: ${chalk.cyan(`socifyr status ${postId}`)}`)
        }
      } catch (err) {
        console.error(chalk.red('✗ Failed to post'))
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
