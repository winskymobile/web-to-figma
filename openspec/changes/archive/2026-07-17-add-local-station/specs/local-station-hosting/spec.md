## ADDED Requirements

### Requirement: Local development server
The monorepo SHALL expose a package script so developers can run the station via `pnpm --filter local-station dev` and open it at a localhost URL.

#### Scenario: Dev server starts
- **WHEN** a developer runs the local-station dev script after installing dependencies
- **THEN** a Vite (or equivalent) dev server serves the SPA on a documented port

### Requirement: Production static build
The station SHALL build to static assets under the package `dist` directory via `pnpm --filter local-station build`.

#### Scenario: Build output
- **WHEN** the production build completes successfully
- **THEN** the `apps/local-station/dist` (or package-configured outDir) contains index HTML and bundled assets

### Requirement: Docker nginx image serves the SPA
The project SHALL provide a Dockerfile that multi-stage builds the monorepo station and serves the static files with nginx, mapping container port 80 for host access (e.g. 8080:80).

#### Scenario: Container run
- **WHEN** a user builds and runs the Docker image with port mapping
- **THEN** opening the mapped host URL loads the local-station UI

### Requirement: No server-side conversion in the container
The Docker-hosted service MUST only serve static front-end assets; conversion MUST remain in the user’s browser.

#### Scenario: Container process model
- **WHEN** the container is running
- **THEN** it does not require Playwright/Chromium or a conversion API for the MVP path
