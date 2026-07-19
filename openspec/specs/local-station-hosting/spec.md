# local-station-hosting Specification

## Purpose
TBD - created by archiving change add-local-station. Update Purpose after archive.
## Requirements
### Requirement: Local development server
The monorepo SHALL expose package scripts so developers can run the station via `pnpm --filter web-to-figma dev` and open it at a localhost URL.

#### Scenario: Dev server starts
- **WHEN** a developer runs the web-to-figma dev script after installing dependencies
- **THEN** a Vite (or equivalent) dev server serves the SPA on a documented port

### Requirement: Production static build
The station SHALL build to static assets under the package `dist` directory via `pnpm --filter web-to-figma build`.

#### Scenario: Build output
- **WHEN** the production build completes successfully
- **THEN** `apps/web-to-figma/dist` contains index HTML and bundled assets

### Requirement: Docker nginx image serves the SPA
The project SHALL provide a Dockerfile that multi-stage builds the monorepo station and serves static files with nginx. Default image name is `web-to-figma`, container name `web-to-figma`, host port mapping e.g. `8080:80`.

#### Scenario: Container run
- **WHEN** a user builds and runs via `docker compose -f apps/web-to-figma/docker-compose.yml up --build -d`
- **THEN** opening the mapped host URL loads the web-to-figma UI

### Requirement: No server-side conversion in the container
The Docker-hosted service MUST only serve static front-end assets; conversion MUST remain in the user’s browser.

#### Scenario: Container process model
- **WHEN** the container is running
- **THEN** it does not require Playwright/Chromium or a conversion API for the MVP path

