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

| Project                                                  | Description                                                                                                                                                         | status     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [chat-app](./projects/chat-app/)                         | Sample chat application built with PartyKit for learning real-time communication, WebSocket architecture, and free hosting possibilities across multiple platforms. | incubating |
| [daily-report-cli](./projects/daily-report-cli/)         | CLI tool for automatically generating engineer daily reports, designed for workflow automation, GitHub Actions, and operational reporting pipelines.                | incubating |
| [doc-scanner-unified](./projects/doc-scanner-unified/)   | Unified CLI and web-based document scanning project that converts images into text for OCR workflows, document digitization, and automation.                        | incubating |
| [email-auto-reply](./projects/email-auto-reply/)         | Tool project for automatically generating email replies, supporting productivity improvement, response drafting, and communication automation.                      | incubating |
| [gather-app](./projects/gather-app/)                     | Virtual workspace and communication platform inspired by Gather, using PartyKit and LiveKit to explore WebSocket/WebRTC architecture and interactive online spaces. | incubating |
| [github-leak-detector](./projects/github-leak-detector/) | Security-oriented tool for detecting leaked source code or sensitive information exposure across GitHub repositories.                                               | incubating |
| [nomikai](./projects/nomikai/)                           | Social app and website for quickly inviting, recruiting, and notifying people for spontaneous drinking events or casual gatherings.                                 | incubating |
| [recstudio](./projects/recstudio/)                       | Browser-based screen recording web application that records and saves video files entirely client-side without backend infrastructure.                              | incubating |
| [stamp-rally](./projects/stamp-rally/)                   | Service platform for creating, sharing, and participating in digital stamp rally experiences for events, tourism, and community engagement.                         | incubating |

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

## Vision

generate-ai-stocks evolves into a development asset platform that accelerates turning ideas into reality first, then into refined, launchable products.
