# TareeqElm Frontend

The web app of **TareeqElm** (طريق علم), an AI-powered learning platform. It is a React + TypeScript single-page app (Vite, Tailwind, shadcn/ui, React Query) that talks to the .NET API in `NafeaBE`.

## Roles

| Role | Area | What they do |
| --- | --- | --- |
| Trainer | `/trainer/*` | Browse and enroll in courses, watch lessons, flashcards and spaced repetition, time blocking, AI study coach, progress and achievements |
| Instructor | `/instructor/*` | Create courses and curricula, quizzes, announcements, analytics |
| University | `/university/*` | Departments, sections, academic terms, instructors, trainers, reports |
| Admin | `/admin/*` | Users, courses, enrollments, platform analytics and settings |

## Ports and environment

| Service | URL |
| --- | --- |
| This app | http://localhost:3001 |
| API (TareeqElm-Backend) | https://localhost:9889 (Swagger/OpenAPI in Development) |
| Website (TareeqElm-Website) | http://localhost:3000 |

Copy `.env.example` to `.env`:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Base URL of the API including `/api`, e.g. `https://localhost:9889/api`. Required for production builds; in development it defaults to `https://localhost:9889/api`. |

`.env` files are not committed.

## Run it

Prerequisites: Node.js 20+ and the API running (see the `TareeqElm-Backend` README).

```sh
npm install
npm run dev        # http://localhost:3001
```

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server on port 3001 |
| `npm run build` | Production build into `dist/` |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint (0 errors and 0 warnings is the target) |
| `npx tsc --noEmit -p tsconfig.app.json` | Type check (TypeScript `strict` is on) |

## Development test accounts

Seeded by the API in Development only:

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@tareeqelm.com | Admin@123 |
| Instructor | instructor@tareeqelm.com | Instructor@123 |
| University | university@tareeqelm.com | University@123 |
| Trainer | trainer@tareeqelm.com | Trainer@123 |

The "Quick Test Login" buttons on the sign-in page only appear in development builds. Do not use these credentials anywhere else.

## Project structure

```
src/
  App.tsx            Providers and routes
  main.tsx           Entry point
  pages/             One file per screen, grouped by role prefix (Instructor*, University*, Admin*, Trainer*)
  components/
    ui/              shadcn/ui primitives
    layout/          Sidebars, header
    auth/, routing/  Route guards
    ...              Feature components (courses, flashcards, timeblocking, ...)
  hooks/             Data and state hooks (useAuth, useCourses, useProgress, ...)
  lib/               api.ts (axios client, getApiError), roles, utils
public/              Static assets (favicon, robots.txt)
```

API access goes through `src/lib/api.ts`: it adds the bearer token, signs the user out on an expired session (401), and `getApiError` turns any failure into a readable message.

## Branding TODO

The favicon in `public/favicon.ico` is a stand-in. The owner still needs to supply the final logo, favicon set and a social share image (Open Graph, 1200x630); then add `og:image` / `twitter:image` tags to `index.html`.
