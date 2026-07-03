# Maven build & deploy (optional) — all 6 frameworks

Every scaffolded project ships an optional **`pom.xml`** so the custom page can be
**built with Maven** (no global Node needed) and, opt-in, **deployed directly** to a
Bonita server (Studio embedded or the Docker bundle) in a single command. The npm
build is unchanged — Maven only wraps it.

Works identically for **React, Vue, Angular, Svelte, Qwik and SolidJS**: all templates
expose `npm run dist` producing `dist/page-<name>.zip`, so the same `pom.xml` fits all.

---

## What the scaffold adds
- **`pom.xml`** (`packaging: pom`):
  - `frontend-maven-plugin` → installs Node (into `target/`, not global), `npm ci`, `npm run dist`.
  - `build-helper-maven-plugin` → **attaches** `dist/page-<name>.zip` as a Maven artifact
    (`<name>:page:zip`) so a Bonita Studio project can consume it as a **provided page**.
  - Profile `deploy` → `npm run deploy` in the `install` phase.
- **`scripts/deploy-page.mjs`** → idempotent REST deploy (login → `/portal/pageUpload` →
  create/update `/API/portal/page`). Parametrized by env; works on any Bonita server.
- **npm script** `deploy`.

The `pom.xml`, `deploy-page.mjs`, `page.token` and zip name are filled in from
`--name` at scaffold time (placeholders replaced), so nothing to edit for the happy path.

## Commands
```bash
mvn package                                  # build only  -> dist/page-<name>.zip
mvn -Pdeploy install                         # build + deploy to the bundle (:8095)
mvn -Pdeploy install -Dbonita.url=http://localhost:PORT/bonita   # deploy to Studio
```
Deploy target/credentials are Maven properties (override with `-D`):
`bonita.url` (default `http://localhost:8095/bonita`), `bonita.user`, `bonita.pass`
(default `install`/`install`), `page.zip`, `page.token`, `node.version`.

## Continuous integration (front repo separate from the Studio project)
No problem — two clean patterns:
- **Decoupled (recommended):** the front CI runs `mvn deploy` and publishes the
  `:page:zip` artifact (GitHub Packages / Nexus, **versioned**). The Studio project CI
  consumes it as a *provided page* dependency → it lands in the app's `-local.zip`.
  Needs a shared artifact repo + version coordination.
- **Mono-pipeline:** the Studio project CI checks out the front (git submodule) and builds
  it in the same job via `frontend-maven-plugin`.

## Local automatic deploy
`mvn -Pdeploy install` builds and deploys directly. The deploy uses the **REST upload**
(Bonita Community has no official "deploy page" Maven goal; on Subscription the Application
Installer deploys the whole application archive). `-Dbonita.url` selects Studio embedded or
the bundle; the page is created on first run and updated afterwards.

## Per-framework differences (the only ones)
The Maven wrapper and the deploy are **identical**. What varies is inside each template's
`npm run dist` (already wired):

| Framework | build | packaged output |
|---|---|---|
| React / Vue / Svelte / Qwik / Solid (Vite) | `vite build` | `dist/` → `dist/page-<name>.zip` |
| Angular (CLI) | `ng build` (→ `dist/<name>/browser`) | `dist/page-<name>.zip` |

So `mvn package` and `mvn -Pdeploy install` are the same command for all six.

## Notes
- `frontend-maven-plugin` downloads Node into `target/` (leaves the global Node untouched)
  and needs network on first run. Keep the Maven build behind a module/profile so it doesn't
  slow builds that don't need it.
- `page.token` must match `page.properties` (`custompage_<name>`) and the application-page mapping.
- Verified end-to-end (build + deploy → HTTP 200) with a Vue/Vite page against a Bonita bundle.
