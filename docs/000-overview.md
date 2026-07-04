# Overview

## Core Technology

Frontend:

- UI - [React](https://react.dev)
- Routing & SSR - [React Router](https://reactrouter.com)
- State Management - [Zustand](https://zustand-demo.pmnd.rs)
- 3D Graphics - [Three.js](https://threejs.org), [@react-three/fiber](https://r3f.docs.pmnd.rs)
- Forms - [@conform-to/react](https://conform.guide)
- Data Fetching - [URQL](https://commerce.nearform.com/open-source/urql)
- Component Library - [@base-ui-components/react](https://base-ui.com)
- Styling - [Panda CSS](https://panda-css.com)

Backend:

- Web Server - [Hono](https://hono.dev)
- Database - [PostgreSQL](https://postgresql.org) + [Drizzle ORM](https://orm.drizzle.team)
- API Layer - [tRPC](https://trpc.io), [GraphQL](https://graphql.org) + [Pothos](https://pothos-graphql.dev)
- Authentication - [TOTP](https://github.com/epicweb-dev/totp), [jose](https://github.com/panva/jose)
- Email - [React Email](https://react.email), [Resend](https://resend.com)

Development:

- Build - [Vite](https://vitejs.dev), [esbuild](https://esbuild.github.io)
- Testing - [Vitest](https://vitest.dev), [Playwright](https://playwright.dev), [MSW](https://mswjs.io)
- Monorepo - [NX](https://nx.dev)
- Type Safety - [TypeScript](https://typescriptlang.org), [Zod](https://zod.dev)
- Monitoring - [Sentry](https://sentry.io)

## Projects

Applications & Services:

- `app-web` - main web app
- `app-web-e2e` - e2e test suite for main web app
- `db-postgres` - postgres production migration runner
- `service-api` - GraphQL API gateway
- `service-avatar` - avatar domain tRPC service
- `service-email` - resend wrapper tRPC service
- `service-session` - session domain tRPC service
- `service-user` - user domain tRPC service
- `service-verification` - verification domain tRPC service

Libraries:

- `lib-aether-client` - client code (react, three, zustand) for the aether feature
- `lib-aether-core` - platform agnostic code for the aether feature
- `lib-client-test-utils` - react & web worker testing utilities
- `lib-data` - core static game data
- `lib-design-system` - ui component library
- `lib-email-templates` - react email template factories
- `lib-idle-client` - client code (react, zustand, worker) for the idle simulation
- `lib-idle-core` - platform agnostic code for the idle simulation
- `lib-panda-preset` - design tokens & panda css config
- `lib-postgres-schema` - postgres schemas
- `lib-service-test-utils` - postgres test container & mock data utils
- `lib-service-types` - tRPC service payload types
- `lib-service-utils` - postgres, logging, jwt utils & hono middleware
- `lib-styled-system` - generated code for panda css design system
- `lib-utils` - low level platform agnostic utils
- `lib-validation` - shared zod schemas
