# Agents

This document enumerates the high-level domain agents that compose the `lms-backend` application. Each agent is a focused NestJS module with a clear responsibility, and the application wiring in `src/app.module.ts` provides a quick reference for what each agent does and its key collaborators.

## Agent Catalogue

- **User Agent** – coordinates user onboarding, authentication, refresh tokens, and general profile management; hooks into `src/user` and relies on guards/middleware wired through `ConfigModule`.
- **Interview Agent** – manages interview creation, scheduling, and lifecycle events (`src/interview`); it delegates transcription orchestration to the `Interview Transcription Agent`.
- **Interview Transcription Agent** – runs transcription jobs (`src/interview-transcription`) and exposes reporting via `InterviewTranscriptionReportModule`; interacts with `tensordock` configuration values when `InterviewModule` dispatches a job.
- **Journal Record Agent** – stores and queries journal entries (`src/journal-record`) for audits and audit trail features.
- **Markdown Content Agent** – controls the curated markdown blocks served to clients (`src/markdown-content`).
- **Material Agent** – handles curriculum, learning resources, and material bundles (`src/material`).
- **Task Agent** – orchestrates asynchronous tasks bookkeeping, dependencies, and scheduling (`src/task`).
- **Subject Agent** – defines subjects/topics metadata (`src/subject`) used by materials and tasks to stay grouped.
- **Feedback Agent** – receives and persists structured feedback (`src/feedback`); it validates payloads through `validation.ts`.
- **Metrics Agent** – publishes Prometheus-friendly metrics (`src/metrics`) through `prom-client` and exposes `/metrics`.
- **Image Agent** – writes to the configured storage backend (`src/image`) and is bootstrapped with `ImageModule.forRoot({ useRealStorageAdapters: true })`.
- **Video Agent** – manages video uploads/streaming metadata (`src/video`), including ffmpeg helpers and storage coordination.
- **Telegram Agent** – runs background Telegram bots (`src/telegram`) and toggles between real API and mocks via `TelegramModule.forRoot`.
- **HR Connection Agent** – links with HR services/partners (`src/hr-connection`).
- **Post Agent** – exposes blog-like posts and announcements (`src/post`).
- **Subscription Agents** – `SubscriptionTierModule`, `SubscriptionModule`, `PaymentModule`, and `YookassaModule` form the billing story, using `yookassa` config, `subscriptionConfig`, and `subscriptionBillingConfig`.
- **Infrastructure Agent** – `InfraModule` centralizes Redis, database, and other infra wiring via `infra/infra.module.ts`.
- **SSE Agent** – `SseModule` exposes server-sent events and keeps long-running listeners alive (`src/sse`).
- **Telegram & Notification Agents** – `SubscriptionModule`, `PaymentModule`, and `TelegramModule` collaborate to notify subscribers about billing events.

## Supporting Configurations

- **Config Module** – the entry point for configuration values such as `jwtConfig`, `redisConfig`, `s3Config`, `yookassaConfig`, `interviewTranscriptionConfig`, and custom feature toggles. Always load new agent-specific environments via `ConfigModule.forRoot`.
- **InfraModule.forRoot({ useRedisTLS: process.env.NODE_ENV !== 'dev' })** – toggles TLS protection depending on the environment; new agents that rely on Redis should surface a similar flag.
- **Module Feature Flags** – several modules accept `forRoot` options (e.g., `ImageModule`, `telegramModule`) to avoid hitting external APIs in dev. Keep these options documented inside the agent’s module file when adding new features.

## Adding or Updating an Agent

1. Create a dedicated folder under `src/` for the agent, following the existing feature folder patterns (`adapters`, `services`, `usecases`, etc.).
2. Export a NestJS module and import it in `src/app.module.ts`. If you need configuration, register it via `ConfigModule.forRoot`.
3. If the agent interacts with external services, add the necessary configs (e.g., `app/config/*.ts`) and guard their usage with dev/production toggles.
4. Update this document with a short description so teammates understand the agent's role at a glance.
5. When the agent exposes HTTP endpoints, describe the main contracts either here or in a dedicated `README` within the feature folder for easier discovery.

## When to Reference This File

- Before spinning up a new contract/module to understand how the existing agents divide responsibilities.
- When onboarding teammates so they can quickly map business domains to code modules.
- When writing docs, use this file to locate the right agent and link back to it for clarity.

## Setup commands

- Get npm and npx commands: `nvm use v22`
- Add package: `npm install`
- Make migration: `npx kysely migration make`
- Run e2e tests: `npm run test:e2e`