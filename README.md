# generate-ai-stocks

[日本語版はこちら / Japanese README](./README.ja.md)

generate-ai-stocks is an integrated repository designed to transform ideas that would otherwise be buried by time constraints into working implementations using generative AI first, then refine, integrate, and launch them as reusable development assets.

---

## Purpose

- Prevent ideas from stopping at the concept stage
- Maximize implementation speed
- Prioritize getting ideas into a working state first
- Accumulate projects as reusable, integratable assets
- Launch promising projects independently

---

## Core Philosophy

### 1. Build working implementations first

Instead of spending excessive time building everything manually from scratch, generative AI is used to rapidly create functional first versions.

### 2. Refine after functionality exists

Once something works:

- Improvements become clearer
- Integration becomes easier
- Explanation to others becomes easier
- Launch decisions become easier

### 3. Even samples become assets

Technical experiments, prototypes, and samples are also valuable when they function properly, because they reduce future:

- Development time
- Integration cost
- Explanation cost
- Reuse barriers

---

## Project Categories

### Product Candidate

Launch / SaaS / monetization candidates

### Utility / Automation

CLI / GitHub Actions / operational tooling

### Technical Asset

Samples / infrastructure experiments / reusable technical foundations

---

## Development Phases

- incubating → Idea becoming real
- validating → Improving and operational tuning
- launched → Public / independently operational
- archived → Maintenance stopped / retained as technical asset

---

## Projects

| Project                                                                      | Description                                                                                                                                                                          | status     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| [ai-agent-demo-genarator](./projects/ai-agent-demo-genarator/)               | Automates GitHub pull request creation by leveraging AI to modify code based on issue triggers, utilizing either Google Cloud or a cost-optimized Cloudflare/local LLM setup.        | incubating |
| [ai-chat-auto-set-key](./projects/ai-chat-auto-set-key/)                     | Automatically scrapes GitHub README tables, stores them in Cloudflare KV, and provides a ChatGPT-like chat UI using the data as context.                                             | incubating |
| [aozora-map](./projects/aozora-map/)                                         | Web app displaying Bluesky posts with location data on a map using React and Cloudflare Workers.                                                                                     | incubating |
| [ar-editor-preview](./projects/ar-editor-preview/)                           | A multi-platform development environment that sends real-time AR data from ARCore/ARKit to Unity Editor via LiveKit and Protocol Buffers for AR previews in Unity.                   | incubating |
| [ar-recorder](./projects/ar-recorder/)                                       | Monorepo for recording and sharing AR experiences using ARCore/ARKit, with Unity integration and LiveKit streaming capabilities.                                                     | incubating |
| [ar-timecapsule](./projects/ar-timecapsule/)                                 |                                                                                                                                                                                      | incubating |
| [attention-intervention-system](./projects/attention-intervention-system/)   | Android application utilizing Compose, Hilt, and Room for data persistence, likely focused on user interaction or a specific task.                                                   | incubating |
| [auto-product-video-generator](./projects/auto-product-video-generator/)     | AI-powered tool that generates promotional videos for web applications and command-line interfaces, automating scenario creation, recording, voiceovers, and rendering.              | incubating |
| [background-speech-recognizer](./projects/background-speech-recognizer/)     | Android app and CLI that use local VAD and whisper.cpp to continuously transcribe microphone audio in real time.                                                                     | incubating |
| [clipboard-manager](./projects/clipboard-manager/)                           | Cross-platform clipboard manager with Android and iOS apps, including keyboard and widget functionality, and monetization options like AdMob and in-app subscriptions.               | incubating |
| [daily-report-cli](./projects/daily-report-cli/)                             | A CLI tool for automatically generating engineering daily reports, designed for use with GitHub Actions and business automation pipelines.                                           | incubating |
| [doc-scanner-unified](./projects/doc-scanner-unified/)                       | An OCR-enabled CLI/Web integrated document scanning project for document digitization and automation use cases.                                                                      | incubating |
| [email-auto-reply](./projects/email-auto-reply/)                             | A tool project for automatically generating email replies, usable for draft emails, business efficiency, and automated response systems.                                             | incubating |
| [fullstack-image-converter](./projects/fullstack-image-converter/)           | ConvertMate is a browser-based platform for batch file conversion, supporting images, videos, and documents with no uploads.                                                         | incubating |
| [github-leak-detector](./projects/github-leak-detector/)                     | A security monitoring tool that detects source code leaks and confidential information leaks on GitHub.                                                                              | incubating |
| [heart-linker-app](./projects/heart-linker-app/)                             | Cross-platform contact exchange app for iOS and Android, supporting QR code, Nearby (Android only), and NFC transfer methods without requiring an account.                           | incubating |
| [kayaba-broadway](./projects/kayaba-broadway/)                               | An online marketplace where users can walk through 3D maps and purchase digital content using Cloudflare Workers, Hono, Angular, PixiJS, LiveKit, and Partykit.                      | incubating |
| [medicine-manager-app](./projects/medicine-manager-app/)                     | Monorepo for a medicine management app with Android and iOS implementations, currently featuring database schema and a basic checklist screen.                                       | incubating |
| [nomikai](./projects/nomikai/)                                               | A social app/web service for quickly inviting, recruiting, and notifying people for impromptu gatherings or casual meetups.                                                          | incubating |
| [noroshi-app](./projects/noroshi-app/)                                       | AR application that displays virtual smoke signals at specified locations, viewable through an AR camera.                                                                            | incubating |
| [offline-chat-app](./projects/offline-chat-app/)                             | Develops an offline chat application for Android and iOS using Nearby Connections/Multipeer Connectivity, enabling peer-to-peer communication without internet access.               | incubating |
| [PackingListApp](./projects/PackingListApp/)                                 | A simple Android application for creating and managing packing lists for travel or other occasions.                                                                                  | incubating |
| [passport-nft](./projects/passport-nft/)                                     | A Solana-based passport and border crossing NFT stamp management system with React/Vite frontend and Cloudflare Workers, Hono, D1, and Drizzle ORM API.                              | incubating |
| [phantomcat-landing](./projects/phantomcat-landing/)                         | A static website for the Night of the Phantom Cat project, built with Next.js and Cloudflare Workers to manage news articles and content generation.                                 | incubating |
| [phone-load-balancer](./projects/phone-load-balancer/)                       | Multi-tenant phone load balancer built with Vonage Voice API, Cloudflare Workers, D1, Hono, and Next.js for routing calls based on tenant configuration and priority.                | incubating |
| [plateau-sniper-vs-guardman](./projects/plateau-sniper-vs-guardman/)         | A multiplayer sniper vs. bodyguard simulation game built with Unity, Next.js, and WebRTC for real-time interaction.                                                                  | incubating |
| [recstudio](./projects/recstudio/)                                           | A browser-only web app that records and saves video without a backend.                                                                                                               | incubating |
| [remove-light-shadow-camera-app](./projects/remove-light-shadow-camera-app/) | Android camera app replicating Pixel phone features, including image processing and potentially location data integration.                                                           | incubating |
| [research-examples](./projects/research-examples/)                           | A collection of sample projects for investigating the usage of SaaS, tools, libraries, and cloud features. It includes verification code and management scripts for each technology. | incubating |
| [signalforge](./projects/signalforge/)                                       | SignalForge transforms engineering activity logs into professional content for platforms like LinkedIn and X, automating the creation of developer branding materials.               | incubating |
| [stamp-rally](./projects/stamp-rally/)                                       | A service for creating, sharing, and participating in stamping events, designed for events, tourism, and regional revitalization.                                                    | incubating |
| [tappun-app-studio](./projects/tappun-app-studio/)                           | A gaming-inspired portfolio website showcases mobile apps built with Next.js, TypeScript, and Framer Motion.                                                                         | incubating |
| [tappunpages](./projects/tappunpages/)                                       | Portfolio website showcasing personal projects and skills, built with Next.js, TypeScript, and deployed via Cloudflare Workers for optimized performance and international reach.    | incubating |

---

## Development Workflow

### Add new project

```bash
npm run projects:add -- --name my-new-project --description "Project description"
```

### Sync portfolio + README

```bash
npm run projects:sync
```

### Validate project.yml

```bash
npm run projects:validate
```

---

## Submodule Workflow (Post-launch)

### Initial clone

```bash
git clone --recurse-submodules <repo-url>
```

### Pull latest parent + all submodules

```bash
npm run projects:pull
```

### Push all development updates

```bash
npm run projects:push
```

### Check status

```bash
npm run projects:status
```

---

## Submodule Notes

- Continue development inside generate-ai-stocks as before
- Launch-ready projects can become independent repositories
- Same environment reproducible across multiple PCs
- Parent repo functions as central command hub

---

## Operational Strategy

### Phase1:

Idea → Generate → Working Implementation

### Phase2:

Refine / Integrate

### Phase3:

Launch / Spin-out

---

## Repository Lifecycle

Projects in this repository typically follow this lifecycle:

1. Create a new project under `projects/`
2. Develop and validate the idea
3. Publish it as an independent repository when it becomes mature
4. Reconnect it as a Git Submodule
5. Continue managing it from this repository

This approach allows centralized discovery while keeping each project independent.

### Converting a Project into an Independent Repository

Create a new repository and push the project:

    cd projects/my-project

    git init
    git add .
    git commit -m "Initial commit"

    git branch -M main

    git remote add origin https://github.com/<user>/my-project.git

    git push -u origin main

Remove the local directory from the parent repository:

    git rm -r projects/my-project

    git commit -m "Remove local project"

Add it back as a Git Submodule:

    git submodule add https://github.com/<user>/my-project.git projects/my-project

    git commit -m "Add submodule"

### Clone Repository with Submodules

    git clone --recursive <repository-url>

### Initialize Submodules After Clone

    git submodule update --init --recursive

### Update All Submodules

    git submodule update --remote

### Remove a Submodule

    git submodule deinit -f projects/my-project

    git rm -f projects/my-project

    rm -rf .git/modules/projects/my-project

---

## Vision

generate-ai-stocks evolves into a development asset platform that accelerates turning ideas into reality first, then into refined, launchable products.
