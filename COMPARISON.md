# Framework comparison for Bonita custom pages — measured data

Comparaison des frameworks pour les Bonita custom pages — données mesurées
Comparativa de frameworks para custom pages de Bonita — datos medidos

> All numbers below come from **building the same `directory-bonita` example** — same scenario (login + Bonita session probe + pending tasks list + logout) — across **six** frameworks. Measured 2026-04-29 against Bonita's REST API.

---

## 1. Measured metrics (real builds)

Each row is a runnable project under `examples/{framework}-directory-bonita/`. The build command is identical: `./build.sh` → `dist/page-*.zip`.

| Framework | ZIP size | JS total | **JS gzip** | Files in ZIP | Source LOC | Component lib used |
|-----------|----------|----------|-------------|---------------|------------|--------------------|
| **SolidJS** | **15 KB** | 37 KB | **14 KB** | 5 | 533 | none (plain CSS) |
| **Svelte 5** | 22 KB | 53 KB | 20 KB | 5 | 577 | none (plain CSS) |
| **Qwik (SPA)** | 31 KB | 64 KB | 25 KB | **14 (lazy chunks)** | 478 | none (plain CSS) |
| **Angular 18** | 92 KB | 581 KB | 175 KB | 10 | 710 | none |
| **React 19** | 353 KB | 1 109 KB | 349 KB | 5 | 547 | Ant Design 5 |
| **Vue 3** | 380 KB | 1 003 KB | 330 KB | 12 | 557 | Element Plus |

> **Important caveat for fair reading**: React and Vue ship a heavyweight component library (AntD / Element Plus) that's responsible for most of the bundle weight. Solid, Svelte and Qwik run on plain CSS in our examples. If you add a comparable component library to Solid (e.g. SolidUI) or Svelte (Skeleton, Svelte UI), expect their gzip to climb to ~80–150 KB — still **2× to 5× lighter than React + AntD**, but the gap is not as dramatic as the raw numbers suggest.
>
> Angular ships with no UI library here, which is why it's 175 KB gzip rather than the ~350 KB React/Vue numbers — but Angular's framework runtime is heavier than the others' (Angular CLI + zone.js + DI).

### Observations on the numbers

- **Solid** is the smallest framework runtime by a wide margin: ~14 KB gzip for a fully-featured SPA with auth, hash routing, and a fetch wrapper.
- **Svelte** is essentially tied with Solid; the compiler erases the framework at build time, so what ships is mostly your code.
- **Qwik** breaks the build into **9 lazy chunks** automatically. The initial JS sent on first load is far less than the totals shown — that's the whole point of *resumability*. For a deployed page, Qwik's "time to interactive" is the lowest of the six.
- **Angular** has the largest framework runtime among the new generation (esbuild output ~175 KB gzip), but it includes router, forms, HttpClient, signals, DI, change detection — a lot of built-ins.
- **React** and **Vue** numbers are dominated by the chosen UI library, not the framework itself. React 19 alone is ~50 KB gzip; AntD adds ~300 KB gzip.

---

## 2. When to pick what — opinionated guidance

### Pick **React** if…

- The team already knows it (most likely scenario at most consultancies)
- You need a mature library ecosystem (form builders, charts, calendars, datagrids — React's community is the biggest)
- The custom page is part of a larger React codebase you maintain

Avoid if: your custom page must be tiny (under 100 KB ZIP) or load on weak networks.

### Pick **Vue 3** if…

- The team prefers Vue's `<script setup>` and template syntax
- You want a balanced ecosystem (Element Plus / Naive UI / PrimeVue all good)
- Migration path matters: Vue 2 → Vue 3 was painful, Vue is now in long-term-conservative mode

Same caveats as React on bundle size.

### Pick **Angular** if…

- You're in a corporate/enterprise environment where Angular is standard
- You need the full kit (router, DI, RxJS, signals, forms) without adding 5 dependencies
- You're comfortable with the 6-month release cadence and occasional refactoring

The smallest "batteries included" option of the six. Best balance for **multi-page Bonita applications** where the team will maintain the code over years.

### Pick **Svelte 5** if…

- You want minimal bundle size with a comfortable, "HTML-like" syntax
- Your custom page is a **standalone tool** that doesn't share code with other apps
- You're hiring (lots of devs want to learn Svelte; finding maintainers is easier than for Solid/Qwik)

Best **all-rounder** for new Bonita custom pages in 2026 IF you don't already have React/Vue/Angular in-house.

### Pick **SolidJS** if…

- Performance is a hard requirement (massive task lists, real-time dashboards, ten-thousand-row tables)
- You like JSX (React-like syntax) but hate React's bundle size
- You're OK with a smaller ecosystem (some 3rd-party libs may not exist)

The fastest of the six in raw rendering benchmarks, by a meaningful margin. Best when **rendering speed beats ergonomics**.

### Pick **Qwik** if…

- The page is heavy (lots of widgets, charts, 50+ components) and you need instant first-paint
- You can accept a young framework (some breaking changes still likely 2026–2027)
- The user typically interacts with **a small fraction** of the page (Qwik only downloads JS for what's clicked)

Niche but powerful. Best when **the page is huge but most users only touch part of it**.

---

## 3. Maintenance & evolution risk (2026 outlook)

| Framework | Breaking changes | Talent availability | Long-term support | Verdict for a 5-year Bonita page |
|-----------|------------------|---------------------|-------------------|-------------------------------------|
| **React** | Low — very conservative | **Highest** | Indefinite | Safe pick if team knows it. Library churn (not framework churn) is the real maintenance cost. |
| **Vue 3** | Low (post 2→3 trauma) | High | Indefinite | Safe. Smaller community than React but very stable codebase. |
| **Angular** | Medium — 6-month majors, signals migration recently | **Highest in enterprise** | Indefinite | Safe but expect to refactor every 1–2 years to stay current. |
| **Svelte 5** | **High right now** — runes API replaced reactive labels in 2024–25 | Medium-High and rising | 7–10 years | Safe IF you start with Svelte 5 today. Old Svelte 3/4 code will need migration. |
| **SolidJS** | Low — author values stability | **Low** (small community) | 5–7 years | Safe technically. Risk is finding the next maintainer in 3 years. |
| **Qwik** | High — youngest, still evolving | **Lowest** | Unknown | Risky for 5-year code. Use when first-load speed is critical and worth the bet. |

### Practical advice for Bonita custom pages

1. **Use TypeScript everywhere.** When framework APIs change, the compiler tells you exactly where you need to fix code. This applies to all six.
2. **Minimize 3rd-party UI library dependencies.** A datagrid library that gets abandoned will hurt you more than the framework upgrading.
3. **The "vanilla" factor matters for longevity.** Svelte and Solid produce code so close to standard JS that, even if the framework disappeared, the output is readable. Angular and Qwik "lock you in" more deeply.
4. **Custom pages are usually small.** A custom page rarely has 100 components — the real differentiation between frameworks at this scale is bundle size and team familiarity, not architecture.

---

## 4. Other frameworks worth knowing (not built here)

These exist and are sometimes proposed for Bonita pages, but we did NOT build examples — their fit ranges from "viable but odd" to "wrong tool":

| Framework | Status | Verdict for Bonita custom pages |
|-----------|--------|-------------------------------------|
| **Astro** | Static-site generator with islands | **Wrong tool.** Astro emits multiple HTML files (one per route). A custom page is a single SPA. Could work for Bonita-hosted documentation pages, not for interactive task UIs. |
| **Lit** | Web Components from Google | Viable. Tiny bundle, native browser standard. Best when you want components reusable across multiple frameworks. Niche ecosystem. |
| **Preact** | React-compatible, 3 KB | Viable. Drop-in for React projects when you want a smaller bundle. Same patterns as React, so same docs apply with minor adjustments. |
| **Alpine.js** | Sprinkles of reactivity in HTML | Wrong tool for a real SPA. Use it for tiny interactive widgets inside Bonita's default layout, not full custom pages. |
| **HTMX** | HTML-first, server-driven | Wrong tool. Bonita doesn't expose the kind of server endpoints HTMX expects. |
| **Mithril** | Lightweight, ~10 KB | Viable but uncommon. Old-school feel, very small community. |

If a customer brings their own framework choice, the seven non-negotiable rules in the toolkit's `bonita-custom-page` skill apply regardless: relative base path, hash routing, `credentials: 'include'`, CSRF token, ZIP layout with `page.properties` at root, restrictive CSP, no SSR.

---

## 5. Decision tree (1-minute version)

```
Are you already using one of React / Vue / Angular?
├── Yes → Stick with what your team knows. The 175–350 KB gzip is fine for an internal Bonita app.
└── No, starting fresh
     │
     Is bundle size critical (mobile, slow networks, or compliance)?
     ├── Yes
     │    │
     │    Do you like JSX / come from React?
     │    ├── Yes → SolidJS
     │    └── No  → Svelte 5
     │
     Is the page huge with lots of interactive widgets?
     └── Yes → Qwik (accept the maintenance risk)
        No  → Svelte 5 (the "default" for new lightweight Bonita pages)
```

---

## 6. The full sample, all six

The six runnable directory-bonita examples implement **the same scenario** (login + Bonita session probe + pending tasks list + logout) with the same backend API. Each can be opened independently and built with one command.

| Example | Path | Final URL after deploy |
|---------|------|-----------------------|
| React | `examples/react-directory-bonita/` | `/bonita/apps/appDirectoryBonitaReact/home/` |
| Vue 3 | `examples/vue-directory-bonita/` | `/bonita/apps/appDirectoryBonitaVue/home/` |
| Angular | `examples/angular-directory-bonita/` | `/bonita/apps/appDirectoryBonitaAngular/home/` |
| Svelte 5 | `examples/svelte-directory-bonita/` | `/bonita/apps/appDirectoryBonitaSvelte/home/` |
| SolidJS | `examples/solid-directory-bonita/` | `/bonita/apps/appDirectoryBonitaSolid/home/` |
| Qwik | `examples/qwik-directory-bonita/` | `/bonita/apps/appDirectoryBonitaQwik/home/` |

```bash
cd examples/svelte-directory-bonita    # or any of the six
./build.sh                              # → dist/page-*.zip + DEPLOY-README.{md,html}
```

All six use the same Bonita 2025.x deployment flow: upload via `superAdminAppBonita/resource-list/`, create the application with **`Layout Without Menu`**, bind the page with token `home`. See `DEPLOY_2025.md`.

---

# Comparaison des frameworks (Français)

Toutes les mesures ci-dessous proviennent de la **construction du même exemple `directory-bonita`** (login + sonde de session Bonita + liste des tâches en attente + déconnexion) avec **six** frameworks différents. Mesuré le 29/04/2026 contre l'API REST de Bonita.

## Mesures réelles

| Framework | Taille ZIP | JS total | **JS gzip** | Fichiers ZIP | LOC source | Bibliothèque UI |
|-----------|------------|----------|-------------|---------------|------------|-----------------|
| **SolidJS** | **15 KB** | 37 KB | **14 KB** | 5 | 533 | aucune |
| **Svelte 5** | 22 KB | 53 KB | 20 KB | 5 | 577 | aucune |
| **Qwik (SPA)** | 31 KB | 64 KB | 25 KB | **14 (lazy)** | 478 | aucune |
| **Angular 18** | 92 KB | 581 KB | 175 KB | 10 | 710 | aucune |
| **React 19** | 353 KB | 1 109 KB | 349 KB | 5 | 547 | Ant Design 5 |
| **Vue 3** | 380 KB | 1 003 KB | 330 KB | 12 | 557 | Element Plus |

> **Mise en garde** : React et Vue embarquent une bibliothèque de composants lourde (AntD / Element Plus). Solid, Svelte et Qwik utilisent du CSS pur dans nos exemples. Avec une bibliothèque équivalente, Solid/Svelte resteraient 2× à 5× plus légers, mais l'écart serait moins spectaculaire.

## Quand choisir lequel

- **React** : votre équipe le connaît déjà ; écosystème mature ; pas de contrainte de taille.
- **Vue 3** : préférence pour la syntaxe `<script setup>` ; écosystème équilibré ; politique conservatrice.
- **Angular** : environnement entreprise ; tout-en-un (router, DI, signaux, formulaires) ; cycle de 6 mois accepté.
- **Svelte 5** : taille minimale ; syntaxe HTML-like ; meilleur compromis pour les NOUVEAUX projets Bonita.
- **SolidJS** : performance maximale ; vous aimez JSX ; OK avec un écosystème plus restreint.
- **Qwik** : page très lourde où le first-paint instantané est critique ; vous acceptez le risque d'un framework jeune.

## Risque maintenance (2026)

| Framework | Breaking changes | Disponibilité talents | Verdict 5 ans |
|-----------|------------------|------------------------|--------------|
| React | Faible | **Maximum** | Sûr |
| Vue 3 | Faible | Élevée | Sûr |
| Angular | Moyen (signaux) | **Élevée en entreprise** | Sûr avec refactor périodique |
| Svelte 5 | **Élevé** (runes 2024-25) | Moyenne-Haute | Sûr si on part de Svelte 5 aujourd'hui |
| SolidJS | Faible | **Faible** | Risque humain (trouver le successeur) |
| Qwik | Élevé (jeune) | **Très faible** | Risqué pour du code de 5 ans |

## Autres frameworks à connaître

| Framework | Verdict pour Bonita |
|-----------|----------------------|
| Astro | Mauvais outil (génère plusieurs HTML, pas une SPA) |
| Lit | Viable. Web Components natifs, écosystème niche |
| Preact | Viable. Remplace React quand on veut un bundle plus petit |
| Alpine.js | Mauvais outil pour une vraie SPA |
| HTMX | Mauvais outil ici (Bonita n'expose pas les endpoints attendus) |
| Mithril | Viable mais peu commun |

## Arbre de décision

```
Avez-vous déjà React / Vue / Angular en interne ?
├── Oui → Restez sur ce que l'équipe connaît
└── Non, projet neuf
     │
     La taille du bundle est-elle critique ?
     ├── Oui
     │    │
     │    Vous aimez JSX (React) ?
     │    ├── Oui → SolidJS
     │    └── Non → Svelte 5
     │
     La page est-elle énorme avec beaucoup de widgets ?
     └── Oui → Qwik
        Non → Svelte 5 (le défaut pour une nouvelle page Bonita légère)
```

---

# Comparativa de frameworks (Castellano)

Todas las medidas a continuación provienen de **compilar el mismo ejemplo `directory-bonita`** (login + sondeo de sesión Bonita + lista de tareas pendientes + logout) con **seis** frameworks distintos. Medido el 29/04/2026 contra la API REST de Bonita.

## Medidas reales

| Framework | ZIP | JS total | **JS gzip** | Ficheros ZIP | LOC fuente | Librería UI |
|-----------|-----|----------|-------------|---------------|------------|-------------|
| **SolidJS** | **15 KB** | 37 KB | **14 KB** | 5 | 533 | ninguna |
| **Svelte 5** | 22 KB | 53 KB | 20 KB | 5 | 577 | ninguna |
| **Qwik (SPA)** | 31 KB | 64 KB | 25 KB | **14 (lazy)** | 478 | ninguna |
| **Angular 18** | 92 KB | 581 KB | 175 KB | 10 | 710 | ninguna |
| **React 19** | 353 KB | 1 109 KB | 349 KB | 5 | 547 | Ant Design 5 |
| **Vue 3** | 380 KB | 1 003 KB | 330 KB | 12 | 557 | Element Plus |

> **Lectura justa**: React y Vue traen una librería de componentes pesada (AntD / Element Plus) que es la responsable de la mayoría del bundle. Solid, Svelte y Qwik usan CSS puro en nuestros ejemplos. Con una librería equivalente, Solid/Svelte se irían a unos 80-150 KB gzip — siguen siendo 2× a 5× más ligeros, pero el delta no es tan brutal como sugiere la tabla cruda.

## Cuándo elegir qué

- **React**: tu equipo ya lo domina; ecosistema enorme; sin restricción de tamaño.
- **Vue 3**: te gusta `<script setup>`; ecosistema equilibrado; política conservadora post-Vue 2→3.
- **Angular**: entorno corporativo; todo incluido (router, DI, signals, forms); ciclo de 6 meses asumido.
- **Svelte 5**: tamaño mínimo con sintaxis "HTML+JS de toda la vida"; mejor opción para PROYECTOS NUEVOS sin legacy.
- **SolidJS**: rendimiento puro; te gusta JSX; aceptas un ecosistema más pequeño.
- **Qwik**: la página es muy pesada y el first-paint instantáneo es crítico; aceptas el riesgo de un framework joven.

## Riesgo de mantenimiento (2026)

| Framework | Breaking changes | Disponibilidad de talento | Veredicto a 5 años |
|-----------|------------------|----------------------------|---------------------|
| React | Bajo | **Máxima** | Seguro |
| Vue 3 | Bajo | Alta | Seguro |
| Angular | Medio (signals) | **Alta en empresa** | Seguro con refactor periódico |
| Svelte 5 | **Alto** (runes 2024-25) | Media-Alta | Seguro si empiezas en Svelte 5 hoy |
| SolidJS | Bajo | **Baja** | Riesgo humano (encontrar relevo) |
| Qwik | Alto (joven) | **Muy baja** | Arriesgado para código de 5 años |

## Otros frameworks que conocer

| Framework | Veredicto para Bonita |
|-----------|------------------------|
| Astro | Mala herramienta (genera múltiples HTML, no SPA) |
| Lit | Viable. Web Components nativos, ecosistema nicho |
| Preact | Viable. Sustituto de React cuando quieres un bundle más pequeño |
| Alpine.js | Mala herramienta para una SPA real |
| HTMX | Mala herramienta aquí (Bonita no expone los endpoints esperados) |
| Mithril | Viable pero poco común |

## Árbol de decisión

```
¿Ya tienes React / Vue / Angular en casa?
├── Sí → Sigue con lo que el equipo conoce
└── No, proyecto nuevo
     │
     ¿Es crítico el tamaño del bundle?
     ├── Sí
     │    │
     │    ¿Te gusta JSX (React)?
     │    ├── Sí → SolidJS
     │    └── No → Svelte 5
     │
     ¿La página es enorme con muchos widgets?
     └── Sí → Qwik
        No → Svelte 5 (la opción por defecto para una nueva custom page ligera)
```

---

## Reproducir las mediciones / Reproducing the measurements / Reproduire les mesures

Cualquier máquina con Node 20+ puede regenerar la tabla:

```bash
cd ui-bonita-projects   # or wherever you have the workspace

for proj in react-directory-bonita vue-directory-bonita angular-directory-bonita \
           svelte-directory-bonita solid-directory-bonita qwik-directory-bonita; do
  cd "examples/$proj"
  npm install --silent
  npm run dist
  ZIP=$(ls dist/page-*.zip | head -1)
  ZIP_KB=$(($(stat -c%s "$ZIP") / 1024))
  JS_GZIP=$(($(find dist -name "*.js" -exec cat {} + | gzip -9c | wc -c) / 1024))
  echo "$proj  ZIP=${ZIP_KB}KB  JS_gzip=${JS_GZIP}KB"
  cd -
done
```

Numbers will vary by ±5–10% depending on the exact npm package versions installed.
