# socifyr

Post to 10+ social platforms from your terminal. Powered by [`@socifyr/sdk`](../sdk/README.md).

**Supported platforms:** Instagram, Facebook, X (Twitter), LinkedIn, TikTok, YouTube, Threads, Pinterest, Reddit, Bluesky

## Installation

```bash
npm install -g @socifyr/cli
# or
bun add -g @socifyr/cli
```

From the monorepo (unpublished):

```bash
cd packages/cli
pnpm install
pnpm run build
node dist/cli.js --help   # or link the bin: npm link
```

## Setup

```bash
socifyr configure --key sk_ac4f91eb...
# ✓ Configuration saved
#   API key: sk_ac4f91e...
```

Get your API key at **https://socifyr.com/dashboard/integrations#api-keys**. The key belongs to one workspace, so there is no workspace ID to set; use a different key to post to a different workspace. Check what's stored:

```bash
socifyr configure --show
# Current configuration:
#   API key:    sk_ac4f91e...
```

### Environment variables (override stored config)

Handy for CI and scripts — no `configure` step needed:

```bash
export SOCIFYR_API_KEY=sk_...
export SOCIFYR_API_URL=https://api.socifyr.com/api   # optional, self-hosted
```

---

## Commands

### `socifyr connections`

List connected accounts and their slugs — **always start here** to learn what you can post to:

```bash
socifyr connections
# 3 connected accounts:
#
#   📸  instagram-mybrand
#       instagram · @mybrand
#   🎵  tiktok-mybrand
#       tiktok · mybrand
#   ▶️  youtube-mybrand
#       youtube · My Brand Channel
#
# Use slugs with: socifyr post "text" --to <slug1,slug2>
```

Flags: `--json` (raw JSON array), alias `conn`. Warns when a token expires within 7 days.

---

### `socifyr post [text]`

Post text, images, video, or documents. Content can come from an argument, `--file`, or stdin:

```bash
# Text post
socifyr post "Just shipped v2.0 🚀" --to x-myhandle,linkedin-mybrand

# Caption from a file
socifyr post --file CHANGELOG.md --to linkedin-mybrand --ai

# Pipe it
cat release-notes.md | socifyr post --to linkedin-mybrand --wait
```

**Media — local files** (auto-detects image vs video by extension; uploads to your media library first):

```bash
socifyr post "New drop" --media photo1.jpg,photo2.jpg --to instagram-mybrand
socifyr post --media video.mp4 --to tiktok-mybrand,instagram-mybrand --ai --wait
```

**Media — library IDs or public URLs** (no re-upload; library IDs are resolved to their type, so a video ID is never posted as a photo):

```bash
socifyr post "Reuse library asset" --media-id 6a04f715d3d7d93575e65d13 --to instagram-mybrand
socifyr post "From URL" --media-id https://example.com/banner.jpg --to linkedin-mybrand
socifyr post "Deck" --media-id 6a93c01f... --to linkedin-mybrand        # document (PDF)
```

**Scheduling & drafts:**

```bash
socifyr post "Deploy complete" --to x-myhandle --at 2026-06-01T09:00
socifyr post "Maybe later" --to x-myhandle --draft
```

| Flag | Description |
|---|---|
| `-t, --to <slugs>` | Comma-separated connection slugs (required) |
| `-f, --file <path>` | Read caption from a text file |
| `-m, --media <paths>` | Comma-separated local file paths (jpg, png, gif, webp, heic, mp4, mov, avi, mkv, webm, m4v) |
| `--media-id <refs>` | Comma-separated media library IDs or public URLs |
| `--format <format>` | `short_video`, `story`, `feed_video`, `photo_single`, `photo_carousel`, `text_post`, `document_post` |
| `-a, --at <datetime>` | Schedule (ISO 8601) |
| `--ai` | Generate the caption with AI (platform-specific, derived from your `--to` slugs) |
| `-w, --wait` | Poll until done and print per-platform results |
| `--draft` | Save as draft instead of publishing |
| `--json` | Output raw JSON |

Output without `--wait`:

```
✓ Post submitted
  ID: 6b1f0c2a9d3e4f5a6b7c8d9e
  Check status: socifyr status 6b1f0c2a9d3e4f5a6b7c8d9e
```

Output with `--wait`:

```
✓ published

  ✓  youtube → https://youtube.com/shorts/6zaztTmk3Ck
  ✗  instagram
      Requires instagram_content_publish permission
```

Validation rules enforced before submitting: only one video per post, recognized extensions, non-empty content, valid `--format`.

---

### `socifyr status <id>`

Check a post by upload ID, draft ID, or requestId:

```bash
socifyr status 6b1f0c2a9d3e4f5a6b7c8d9e
# Post 6b1f0c2a9d3e4f5a6b7c8d9e
# Status: partial_failure
#
#   ✓  youtube → https://youtube.com/shorts/6zaztTmk3Ck
#   ✗  instagram
#       Requires instagram_content_publish permission
```

Flags: `--json`, `-w, --wait` (poll until terminal).

---

### `socifyr retry <id>`

Re-publish only the **failed** channels of a partial/failed post:

```bash
socifyr retry 6b1f0c2a9d3e4f5a6b7c8d9e --wait
# Retrying failed channels...
# Waiting for results...
#
# Post 6b1f0c2a9d3e4f5a6b7c8d9e
# Status: completed
#
#   ✓  youtube → https://youtube.com/shorts/6zaztTmk3Ck
#   ✓  instagram → https://instagram.com/p/DEF123/
```

Flags: `--json`, `-w, --wait`.

---

### `socifyr publish <id>`

Publish a saved draft immediately:

```bash
socifyr publish 6b1f0c2a9d3e4f5a6b7c8d9e --wait
# Publishing draft...
# Waiting for results...
#
# Post 6b1f0c2a9d3e4f5a6b7c8d9e
# Status: completed
```

Flags: `--json`, `-w, --wait`.

---

### `socifyr media`

Manage your media library.

**`media list`** — flags: `--type <image|video|document>`, `--search <query>`, `--limit <n>` (default 20), `--json`:

```bash
socifyr media list --type video
# Media library (2 total)
#
#   🎬  launch-teaser.mp4
#       ID: 6a93a4bfaa1135c3d8dd3df5   Size: 8.4MB   video
#   🎬  demo-full.mp4
#       ID: 6a93b7c2d1e0f3a4b5c6d7e8   Size: 156.2MB   video
```

**`media upload <file>`** — flags: `--alt <text>` (alt text/description), `--json`:

```bash
socifyr media upload banner.png --alt "Product banner"
# Uploading banner.png...
# ✓ Uploaded
#   ID:   6a937894df74747da8fdb8ba
#   File: banner.png
#   Size: 245.3KB
#   URL:  https://cdn.socifyr.com/...
```

**`media get <id>`** — flags: `--json`:

```bash
socifyr media get 6a937894df74747da8fdb8ba
# 🖼  banner.png
#   ID:       6a937894df74747da8fdb8ba
#   Type:     image
#   Alt:      Product banner
```

**`media delete <ids...>`** — one or many (bulk-deletes when given several), flags: `--json`:

```bash
socifyr media delete 6a937894df74747da8fdb8ba
# ✓ Deleted 1 item

socifyr media delete 6a93... 6a93... 6a93...
# ✓ Deleted 3 items
```

---

## Exit codes

`0` on success, `1` on any failure (missing config, API error, validation). The error message from the API is printed on stderr — safe for scripting:

```bash
socifyr post "hi" --to nonexistent-slug || echo "post failed"
# ✗ Failed to post
# Connection "nonexistent-slug" not found
# post failed
```

## JSON mode

Every command accepts `--json` for machine-readable output (consumed on stdout; progress messages go to stderr):

```bash
socifyr status 6b1f0c2a... --json | jq '.status'
```
