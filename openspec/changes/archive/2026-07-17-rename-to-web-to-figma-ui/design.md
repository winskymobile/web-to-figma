## Context

Product directory is `web-to-figma`. App currently lives at `apps/local-station` with UI name “Local Station” and Docker image `web-to-figma-local-station`. User approved a monochrome fullscreen mock under `preview-mock/toolbar-fullscreen.html`.

## Goals / Non-Goals

**Goals:**
- Single brand: `web-to-figma` for package, UI title, Docker image/container, docs.
- Ship toolbar + full-viewport preview; empty canvas picks HTML; optional asset folder from toolbar; copy/clear in toolbar.
- Preserve conversion pipeline (assets rewrite, CJK fonts, clipboard).

**Non-Goals:**
- Renaming npm packages `@figit/*` or repo remote.
- Changing port (remain 8080 Docker / 4177 dev) unless broken.
- Re-litigating converter fidelity issues.

## Decisions

1. **Directory rename** `apps/local-station` → `apps/web-to-figma` so package and path match.
2. **Docker** image `web-to-figma:latest`, container `web-to-figma`, compose file path `apps/web-to-figma/docker-compose.yml`.
3. **UI** implement from mock: monochrome tokens, toolbar chips, status/missing badge, primary black copy button; stage empty button triggers HTML input; drag-drop HTML on empty stage.
4. **Missing list** only as compact toolbar badge (no sidebar essay); optional expandable later not in this change.

## Risks / Trade-offs

- [Risk] pnpm lockfile / workspace filter break during rename → reinstall after move.
- [Risk] Running old Docker container name conflicts → `docker rm -f` old names on deploy.
