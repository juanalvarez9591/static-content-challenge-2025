# Static Content challenge

**NB: Please do not fork this repository, to avoid your solution being visible from this repository's GitHub page. Please clone this repository and submit your solution as a separate repository.**

Business Scenario: Acme Co's marketing department want a simple content management system and you've been tasked with building the MVP.

The challenge here is to create a full-stack JavaScript application that returns webpages at URLs that match the paths of the folders and sub-folders in the `content` folder. The content of these pages should come from a combination of the template HTML file and a markdown file containing the content.

For example, for a folder called `about-page`, a request to `/about-page` would return a HTML page created from the `template.html` template and the `about-page/index.md` content file. The `template.html` file contains a `{{content}}` placeholder that would be replaced by the content for each page. A request to `/blog/june/company-update` would return a HTML page using the content file at `blog/june/company-update/index.md`.

As a modern full-stack JavaScript app MVP, the application should use an effective mix of technologies, although there is a requirement to use React on the front-end to fit in with Acme Co's other websites.

Acme's marketing department should be able to add extra folders to the `content` folder and the application should work with those without any requiring any code changes.

This repository contains a `template.html` template file and a sample `content` folder with sub-folders containing `index.md` markdown files (or other sub-folders).

Your application may make use of open-source code libraries and other third-party tools. It is entirely up to you how the application performs the challenge. As the use of LLMs is widespread in software engineering, you are permitted to use AI as you wish.

## Testing

The application should be shipped with at minimum three tests, although your testing strategy should effectively test your application:

- one that verifies that requests to valid URLs return a 200 HTTP status code
- one that verifies that requests to valid URLs return a body that contains the HTML generated from the relevant `index.md` markdown file
- one that verifies that requests to URLs that do not match content folders return a 404 HTTP status code
- NB: the tests should not depend on the existing sub-folders in the `content` folder, so the tests do not break as the content changes

## Bonus credit

**NB: This is only relevant if completing this task in your own time, i.e. NOT in a pairing interview**

In this MVP sprint, there are several opportunities to deliver nice-to-have tickets. The marketing team recognise that in a post-LLM world sprint velocity may be higher.

- The generated HTML page should be styled in a pleasing way
- The MVP's GitHub repository should be configured for hosting on a cloud hosting service, and include a link to a live deployment
- The repository should include documentation describing how to both use the application and how to iterate it from here
- Overall, you should do everything you think is necessary to make this application MVP production-ready


---

# Solution

Express + client-side React app that serves every folder under `src/content` that has an `index.md` as a web page at the matching URL. Design notes and decisions live in [SPEC.md](SPEC.md).

## Use it

```sh
npm install
npm run build             # bundles the React client into dist/client (needed before start)
npm start                 # http://localhost:3000
npm run dev               # rebuilds the client on change and restarts the server
npm test                  # unit, functional and integration (Vitest + supertest)
npm run test:e2e          # end to end (Playwright; first run: npx playwright install chromium)
```

- **Add a page:** create a folder under `src/content` with an `index.md` (no code change, no restart). `src/content/index.md` is the home page (`/`).
- **Admin:** the **Admin** link in the site nav goes to `/admin/login`; after signing in you land on `/admin`, where one admin user can create, edit and delete pages. Create the user first (there is no public sign-up):

  ```sh
  ADMIN_USERNAME=me ADMIN_PASSWORD='at least 12 characters' npm run create-admin
  ```

  Page paths in the admin use lowercase letters, digits, `-` and `_`.
- **Sitemap:** the **Sitemap** link in the nav (`/sitemap`) lists every page as a nested tree, generated from the content folders, so new folders show up on their own. `/sitemap` is reserved: it wins over a content folder with that name.
- **Images:** in the page editor, paste an image from the clipboard (Ctrl/Cmd+V) or drop a file onto the Markdown box. It is uploaded and `![image](/uploads/<hash>.png)` is inserted at the cursor, like on GitHub. PNG, JPEG, GIF and WebP up to 5 MB (no SVG). Files are stored in `UPLOADS_DIR` (default `data/uploads`) and served at `/uploads/`; keep that folder on a persistent volume.
- **Config (env vars):** `PORT` (3000), `LOG_LEVEL` (`debug` in dev, `info` when `NODE_ENV=production`), `CONTENT_DIR`, `DB_PATH` (`data/app.sqlite`), `UPLOADS_DIR` (`data/uploads`), `TRUST_PROXY` (hops, default 1), `NODE_ENV=production` (turns on `Secure` cookies; needs HTTPS).

## How it is built

Functional core, imperative shell (see SPEC.md), organised **by operation**: each operation has its own folder holding its deriver, controller and tests together; entities and their repositories have their own folders.

```
src/
  app.js, server.js          wiring only
  page/                      ENTITY Page: page.js (Zod parser), pathInvariants.js, pageRepository.js (files, only I/O)
  template/                  ENTITY Template: template.js (Zod parser), templateRepository.js
  serve-page/                OPERATION: GET a page / sitemap
                             deriveRouteOutcome.js (Deriver), renderPage/renderShell/renderSitemap (pure), serveController.js
  manage-pages/              OPERATION: admin create/read/update/delete
                             validatePagePath.js, derivePageWriteOutcome.js (Deriver), managePagesController.js
  login/                     OPERATION: sign in / out
                             deriveLoginOutcome.js (Deriver), loginController.js
  upload-image/              OPERATION: paste/drop an image
                             detectImageType.js, deriveUploadOutcome.js (Deriver), uploadImageController.js, uploadsRepository.js
  auth/                      sessions: deriveRequestAuth.js (Deriver), requireSession.js, db.js (SQLite repositories), security.js
  admin/adminApi.js          wires the admin routes to the controllers above
  shared/                    http/status.js, errors.js, logging/ (pino + wide events)
  client/                    React app in the browser (Vite): public pages, login, dashboard, editor
tests/integration/           Express + real repositories + temp dirs (supertest)
tests/e2e/                   Playwright
tests/rules/                 architecture rules (e.g. no bare HTTP status numbers)
```

Unit tests (pure functions) and functional tests (a controller with a fake repository) sit **next to the code** as `*.test.js`.

| Building block | Where |
|---|---|
| Entities (parsed at the boundary with Zod) | `page/page.js`, `template/template.js` |
| Invariants (one small named function per rule) | `page/pathInvariants.js` |
| Derivers (pure; return a tagged union of outcomes) | `deriveRouteOutcome` (`PAGE_FOUND \| SITEMAP \| NOT_FOUND \| INVALID_PATH`), `derivePageWriteOutcome`, `deriveLoginOutcome`, `deriveUploadOutcome`, `deriveRequestAuth` |
| Controllers (the shell: load, ask the deriver, perform the effect) | `*Controller.js`, `auth/requireSession.js`. Each has one `RESPONSE_BY_OUTCOME` / `STATUS_BY_OUTCOME` table, the only place an outcome becomes a status |
| Repositories (the only I/O) | `page/pageRepository.js`, `template/templateRepository.js`, `upload-image/uploadsRepository.js`, `auth/db.js` |
| Presentation (React, in the browser) | `src/client/`, `public/` |

- **How a page is served:** `GET /about-page` returns `template.html` with `{{content}}` replaced by the server-rendered page HTML plus a JSON block of initial data (works without JavaScript, good for SEO). The React app then takes over `#root` and navigates client-side, fetching `GET /api/content?path=...`. `/admin/*` returns an empty shell and is entirely client-rendered, talking to `/api/admin/*`.
- **Path safety:** the deriver rejects `..`, null bytes, backslashes and empty segments on the decoded path; the repository independently resolves the real path (symlinks included) and refuses anything outside the content root. Writes from `/admin` get the same two checks.
- **PWA:** mobile-first CSS, `manifest.json`, and a small service worker (network first, cache fallback for visited pages, never caches `/admin` or `/api/admin`).
- **Errors:** expected outcomes are values; unexpected failures are caught once and become a generic 500. Details go only to the log. `unhandledRejection` / `uncaughtException` log and exit so a supervisor restarts the process.
- **Logging:** `pino` JSON to stdout, one wide event per request (`request_id` also in `X-Request-Id`). Level follows the outcome: `warn` for `INVALID_PATH` and failed logins, `error` for 5xx. No cookies, passwords or tokens are logged. The client IP is logged and may be personal data.
- **Admin security:** argon2id passwords, server-side sessions (256-bit random id, stored hashed, rotated on login, `HttpOnly` + `SameSite=Strict`), CSRF token (`X-CSRF-Token` header) on every non-GET request, generic login errors, account lock after 5 failures (also for unknown usernames), per-IP rate limits (429), `helmet` with a strict CSP. Deny by default: everything under `/api/admin` except login needs a session. Uploaded images are validated by magic bytes, stored under a content-hash name and served with `nosniff`.
- **HTTP statuses** are named constants (`src/shared/http/status.js`); a test fails if a bare status number appears in `src`.

## Iterate from here

- New outcome (e.g. redirects): add a variant in `serve-page/deriveRouteOutcome.js`, a row in `STATUS_BY_OUTCOME` and a `case` in `makeLoadPage`; the `default: throw` branch and the tests flag any place you forgot.
- New admin capability: add a new operation folder with its Deriver, controller and tests, a route in `src/admin/adminApi.js` (it is behind the session and CSRF middleware automatically), and a screen under `src/client/admin/`.

## Deployment

Live at **https://static.jpalvarez.xyz**. The app runs as a systemd service on a small shared VPS behind nginx (TLS from Let's Encrypt). There is no Docker on the box: the VPS has 512 MB of RAM, so the pipeline ships a tarball and the service is capped at 200 MB (`MemoryMax`).

**Branches and pipeline**

| Event | What runs |
|---|---|
| Pull request to `main` | `ci.yml`: unit, functional, integration and e2e tests (required check `test`) |
| Push / merge to `main` | `deploy.yml`: the same tests, then build, upload, restart, health check |
| Manual (`workflow_dispatch`) | `deploy.yml` on the selected branch (only `main` may use the `production` environment) |

Work on a feature branch, open a PR, merge when `test` is green; merging deploys. `main` is protected: PRs are required, force pushes are blocked.

The deploy job builds the React client on the runner (never on the VPS), prunes dev dependencies, uploads `release.tgz` over SSH to `/opt/static-content/releases/<sha>`, swaps the `current` symlink atomically, restarts `static-content.service` and waits for `/healthz`. If the new release is unhealthy it switches back to the previous one and fails the job. The last 5 releases are kept; to roll back by hand re-run the workflow on an older commit or `ln -sfn` an older release and restart the service.

**GitHub configuration** (`production` environment): secrets `DEPLOY_HOST`, `DEPLOY_USER` (`static-deploy`), `DEPLOY_SSH_KEY` (dedicated key, can only log in as that user), `DEPLOY_KNOWN_HOSTS` (pinned host key); variable `APP_URL`.

**Server layout** (files in `deploy/`):

| Path on the VPS | Purpose |
|---|---|
| `/opt/static-content/node` | Node 24 (isolated from the system) |
| `/opt/static-content/releases/<sha>`, `current` | deployed releases |
| `/etc/static-content/env` | runtime config (`deploy/static-content.env.example`) |
| `/var/lib/static-content/{content,uploads,app.sqlite}` | marketing content, uploaded images, admin database. **Not touched by deploys**; back these up |
| `/etc/systemd/system/static-content.service` | `deploy/static-content.service` |
| `/etc/nginx/sites-enabled/static.jpalvarez.xyz` | `deploy/nginx-static.jpalvarez.xyz.conf` (certbot adds the TLS block) |
| `/etc/sudoers.d/static-deploy` | the deploy user may only restart this one service |

Content on the server lives in `/var/lib/static-content/content` (seeded once from `src/content`); edit it from `/admin` or directly on disk. The server admin user (`admin`) was created at setup; its generated password is in `/etc/static-content/admin.credentials` (root only), change it after the first sign-in. To create or reset a user run `ADMIN_USERNAME=... ADMIN_PASSWORD=... node scripts/create-admin.js` run as the `static-content` user with the env file loaded.

## Observability

The app writes one JSON wide event per request to stdout; systemd keeps it in the journal. Grafana Alloy on the VPS ships the unit's journal to Loki on a Raspberry Pi (through an existing reverse SSH tunnel), and the Pi's Grafana shows it:

- `observability/alloy/static-content.alloy`: the Alloy block that tails `static-content.service` (label `job="static-content"`)
- `observability/grafana/static-content-ops.json`: the provisioned dashboard `static-content - ops` (requests by status, latency p50/p95, 5xx, blocked traversal attempts, sign-in outcomes, admin actions, warnings and errors)

Useful LogQL: `{job="static-content"} | json | outcome="INVALID_PATH"` for traversal attempts, `{job="static-content"} | json | status >= 500` for errors.
