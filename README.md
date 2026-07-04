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

| Project                                                                    | Description                                                                                                                                                                                                     | status     |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [ai-agent-demo-genarator](./projects/ai-agent-demo-genarator/)             | An event-drivenパイプライン that triggers GitHub’s Issue to automatically create PR by specifying the code。                                                                                                    | incubating |
| [ai-chat-auto-set-key](./projects/ai-chat-auto-set-key/)                   | This is a system that automatically retrieves the Markdown table described in theMarkME of the GitHub repository, stores it in Cloud re KV, and provides a ChatGPT-like chat UI that can be used as a context。 | incubating |
| [aozora-map](./projects/aozora-map/)                                       |                                                                                                                                                                                                                 | incubating |
| [app-studio](./projects/app-studio/)                                       | Next.js app studio site to introduce mobile apps and build promotion pages。                                                                                                                                    | incubating |
| [ar-editor-preview](./projects/ar-editor-preview/)                         | ARCore/ARKit’s real-world AR data is sent to Unity Editor in LiveKit and Protocol ARKs。                                                                                                                        | incubating |
| [ar-recorder](./projects/ar-recorder/)                                     | This is a monorepos。y of AR screen recording and shared library compatible with ARCore/ARKit。                                                                                                                 | incubating |
| [attention-intervention-system](./projects/attention-intervention-system/) | App that displays goals for lock screens and notifications and reminds you of your goals every time you see your smartphone                                                                                     | incubating |
| [auto-product-video-generator](./projects/auto-product-video-generator/)   | This is a 動画 video generation tool for web apps and CLI tools。                                                                                                                                               | incubating |
| [background-speech-recognizer](./projects/background-speech-recognizer/)   | Android apps and CLI tools to record microphone voices locally and use VAD and whisper.cpp to make real-time characters。                                                                                       | incubating |
| [clipboard-manager](./projects/clipboard-manager/)                         | Clipboard Manager App                                                                                                                                                                                           | incubating |
| [daily-report-cli](./projects/daily-report-cli/)                           | CLI tool for automatically generating engineer daily reports, designed for workflow automation, GitHub Actions, and operational reporting pipelines.                                                            | incubating |
| [doc-scanner-unified](./projects/doc-scanner-unified/)                     | Unified CLI and web-based document scanning project that converts images into text for OCR workflows, document digitization, and automation.                                                                    | incubating |
| [email-auto-reply](./projects/email-auto-reply/)                           | Tool project for automatically generating email replies, supporting productivity improvement, response drafting, and communication automation.                                                                  | incubating |
| [fullstack-image-converter](./projects/fullstack-image-converter/)         | B file conversion platform. All images, videos and documents are processed on your browser. No need to upload files。                                                                                           | incubating |
| [github-leak-detector](./projects/github-leak-detector/)                   | Security-oriented tool for detecting leaked source code or sensitive information exposure across GitHub repositories.                                                                                           | incubating |
| [heart-linker-app](./projects/heart-linker-app/)                           | Business card exchange app that can be used without account registration. QR / Nearby(Bluetooth+Wi-Fi) / NFC。                                                                                                  | incubating |
| [kayaba-broadway](./projects/kayaba-broadway/)                             |                                                                                                                                                                                                                 | incubating |
| [medicine-manager-app](./projects/medicine-manager-app/)                   | Drug お App                                                                                                                                                                                                     | incubating |
| [nomikai](./projects/nomikai/)                                             | Social app and website for quickly inviting, recruiting, and notifying people for spontaneous drinking events or casual gatherings.                                                                             | incubating |
| [noroshi-app](./projects/noroshi-app/)                                     | AR WOLF SMOKE APP BASED ON LOCATION INFORMATION. THIS IS AN APP THAT RAISES THE WOLF SMOKE AT THE SPECIFIED POINT, AND YOU CAN SEE THE WOLF SMOKE ACTUALLY BY LOOKING AT THE DIRECTION OF THE AR CAMERA。       | incubating |
| [offline-chat-app](./projects/offline-chat-app/)                           | An offline chat app using Nearby Connections / MultipeerConnectivity without WiFi。                                                                                                                             | incubating |
| [PackingListApp](./projects/PackingListApp/)                               | Android native app that can create travel and business travel belonging lists and manage them as scheduled checklists。                                                                                         | incubating |
| [passport-nft](./projects/passport-nft/)                                   |                                                                                                                                                                                                                 | incubating |
| [phantomcat-landing](./projects/phantomcat-landing/)                       |                                                                                                                                                                                                                 | incubating |
| [phone-load-balancer](./projects/phone-load-balancer/)                     | Vonage Voice API + Cloudテナントre Workers + D1 + Hono + Next.js。                                                                                                                                              | incubating |
| [plateau-sniper-vs-guardman](./projects/plateau-sniper-vs-guardman/)       | sniper vs bodyguard security simulation                                                                                                                                                                         | incubating |
| [recstudio](./projects/recstudio/)                                         | Browser-based screen recording web application that records and saves video files entirely client-side without backend infrastructure.                                                                          | incubating |
| [research-examples](./projects/research-examples/)                         | A collection of sample projects for investigating the usage of SaaS, tools, libraries, and cloud features. It includes verification code and management scripts for each technology.                            | incubating |
| [signalforge](./projects/signalforge/)                                     | A tool to collect information from day-to-day engineering operations, understand the actual work and convert it to the best content for the platform。                                                          | incubating |
| [stamp-rally](./projects/stamp-rally/)                                     | Service platform for creating, sharing, and participating in digital stamp rally experiences for events, tourism, and community engagement.                                                                     | incubating |
| [tappun-app-studio](./projects/tappun-app-studio/)                         |                                                                                                                                                                                                                 | incubating |
| [tappunpages](./projects/tappunpages/)                                     |                                                                                                                                                                                                                 | incubating |

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
