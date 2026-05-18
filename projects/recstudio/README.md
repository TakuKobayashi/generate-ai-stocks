# RecStudio

Browser-native screen recorder with real-time Speech-to-Text transcription.  
No server. No installation. Built with Next.js 15 (App Router, static export) and deployed to Cloudflare Workers Assets.

---

## Features

- **Screen recording** via `getDisplayMedia` — records video + optional audio
- **Audio source selection** — Screen audio, Microphone, or No audio
- **Real-time transcription** — Web Speech API (`SpeechRecognition`), auto-restarts on segment end
- **Download** recorded video (WebM / MP4) and transcript (`.txt`)
- **Fully client-side** — no backend, no data leaves the browser

## Tech

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, `output: 'export'`) |
| Language | TypeScript 5 |
| Styling | CSS Modules (no Tailwind) |
| Fonts | `next/font` → IBM Plex Mono + Sans |
| Hosting | Cloudflare Workers Assets |
| Linting | ESLint (flat config) + Prettier |

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run format
```

## Build & Deploy

```bash
npm run build      # generates ./out
npx wrangler deploy
# or:
npm run deploy     # build + deploy in one step
```

### Wrangler config (`wrangler.jsonc`)

- `assets.directory` → `./out`
- `assets.not_found_handling` → `404-page` (serves `out/404/index.html`)
- `assets.html_handling` → `auto-trailing-slash` (matches Next.js `trailingSlash: true`)

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://recstudio.example.com` | Used for `metadataBase`, sitemap, robots |

Set this in a `.env.local` file or in Cloudflare Pages / Workers environment settings.

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---|---|---|---|---|
| Screen recording | ✅ | ✅ | ✅ (13+) | ✅ |
| Screen audio | ✅ | ❌ | ❌ | ✅ |
| Speech-to-Text | ✅ | ❌ | ✅ | ✅ |

> Speech recognition requires Chrome, Edge, or Safari. Recording works in all modern browsers.

## SEO

- `metadata` object in `app/layout.tsx` (title template, description, keywords, OG, Twitter card)
- Page-level `metadata` override in `app/page.tsx`
- `/sitemap.xml` and `/robots.txt` auto-generated via Next.js metadata routes
- `NEXT_PUBLIC_APP_URL` drives `metadataBase`, sitemap URL, and robots `host`

## Project Structure

```
recstudio/
├── app/
│   ├── globals.css          # CSS variables + base reset
│   ├── layout.tsx           # Root layout, fonts, full SEO metadata
│   ├── page.tsx             # Entry — renders <RecordingApp>
│   ├── not-found.tsx        # 404 page
│   ├── robots.ts            # /robots.txt
│   └── sitemap.ts           # /sitemap.xml
├── components/
│   └── RecordingApp.tsx     # 'use client' — all recording/STT logic
├── styles/
│   └── RecordingApp.module.css
├── public/                  # Static assets (favicon, OG image…)
├── wrangler.jsonc
├── next.config.ts
├── prettier.config.js
└── eslint.config.mjs
```
