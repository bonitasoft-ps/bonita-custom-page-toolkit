# Checklist de pré-vol : préparer votre projet pour `bonita-page wrap`

> Idiomas / Languages / Langues: **[Français (ce document)]** · [English](WRAP-CHECKLIST.md) · [Castellano](WRAP-CHECKLIST.es.md)

Ce document est destiné aux **développeurs qui ont déjà un projet React / Vue / Angular / Svelte / SolidJS / Qwik** et qui veulent l'empaqueter comme une custom page Bonita via la commande `bonita-page wrap` du toolkit.

Il vous dit exactement ce que votre projet doit respecter **avant** de lancer `wrap`, pour que cette étape réussisse et que le ZIP se déploie proprement sur Bonita 2025.x sans intervention IA.

> **Pourquoi ce document existe.** `bonita-page wrap` ajoute uniquement la couche Bonita (`page.properties`, script de packaging, guides de déploiement, helpers de build). Il NE modifie PAS votre code dans `src/`. Si votre projet ne respecte pas déjà les règles ci-dessous, le `wrap` aboutira mais le ZIP déployé plantera à l'exécution. La voie la plus rapide : corriger d'abord les problèmes dans `src/`, puis lancer `wrap`.

---

## Voie express (une seule commande)

Si votre équipe est certaine que le projet respecte les règles, vous pouvez sauter la vérification manuelle et utiliser l'orchestrateur :

```bash
cd /chemin/vers/votre/projet
/chemin/vers/bonita-custom-page-toolkit/bonita-page.sh prepare \
    --name=monTableau \
    --app-token=monApp
# → exécute : check, wrap, npm install, npm run dist
# → produit dist/page-monTableau.zip + DEPLOY-README.{md,html}
```

Si `prepare` s'arrête à la phase `check`, vous saurez exactement quoi corriger (la commande liste les problèmes et s'arrête). Appliquez les `Corrections manuelles par framework` ci-dessous et relancez.

Si vous préférez exécuter les étapes une par une (plus de contrôle, même résultat) :

```bash
bonita-page check                                    # 1. Vérifie
bonita-page wrap --name=monTableau --app-token=monApp  # 2. Ajoute la couche Bonita
npm install                                          # 3. Dépendances
npm run dist                                         # 4. Construit le ZIP
```

---

## TL;DR — la vérification en 8 lignes

Lancez ceci à la racine de votre projet. Si tout passe, vous êtes prêt pour `wrap` :

```bash
# 1. Le projet compile. (Adaptez si votre script porte un autre nom.)
npm run build

# 2. Le build émet un seul index.html et un dossier d'assets hashés.
ls dist                 # frameworks Vite
ls dist/<app>/browser   # Angular

# 3. L'index.html du build utilise des chemins RELATIFS (./assets/...) PAS (/assets/...)
grep -o 'src="[^"]*"' dist/index.html | head -3   # doit commencer par "./"

# 4. Votre routage utilise le mode HASH (pas de 404 au refresh dans Bonita).
#    Cherchez l'un de :
grep -rE "createHashRouter|HashRouter|createWebHashHistory|HashLocationStrategy|svelte-spa-router|@solidjs/router.*HashRouter" src/

# 5. Chaque fetch / HttpClient envoie les credentials + le token CSRF.
#    Cherchez l'un de ceux-ci dans votre couche HTTP :
grep -rE "credentials: ['\"]include|withCredentials|X-Bonita-API-Token" src/
```

Si 1-3 échouent → voir §"Corrections manuelles par framework" plus bas. 4-5 → voir §"Ce que `wrap` NE touche PAS".

Pour une version automatisée de cette vérification :

```bash
bonita-page check         # exit 0 si OK, exit 1 + JSON décrivant les problèmes sinon
```

---

## Ce que votre projet doit respecter (les sept règles + extras Bonita 2025.x)

Ces règles sont universelles pour les six frameworks supportés. En sauter une produit un ZIP qui se construit mais plante à l'exécution.

### 1. Build avec base path relatif

Bonita sert votre custom page depuis une URL profondément imbriquée comme `/bonita/portal/resource/page/{profile}/{name}/content/`. Les chemins absolus (`/assets/index.js`) résolvent vers `/assets/...` — hors du dossier de la page — et donnent un 404.

| Framework | Où | Valeur |
|-----------|----|--------|
| Vite (React/Vue/Svelte/Solid/Qwik) | `vite.config.ts` → `base` | `'./'` (ou `command === 'build' ? './' : '/'`) |
| Angular | `angular.json` → `architect.build.options.baseHref` | `'./'` |

**Comment vérifier** : ouvrez `dist/index.html` (ou `dist/<app>/browser/index.html` pour Angular) après un build. Les balises `<script src="...">` et `<link href="...">` doivent commencer par `./` (ou être de simples noms de fichier). Si elles commencent par `/`, le build est mauvais.

### 2. Routage hash, jamais browser/HTML5

Le Tomcat de Bonita ne réécrit pas les URLs inconnues vers `index.html`. Avec un routage browser, rafraîchir `/tasks/123` retourne 404 car Tomcat cherche une ressource littérale `tasks/123`.

| Framework | Quoi utiliser |
|-----------|---------------|
| React | `createHashRouter` de `react-router-dom` v7 (PAS `createBrowserRouter`) |
| Vue | `createWebHashHistory()` (PAS `createWebHistory()`) |
| Angular | `provideRouter(routes, withHashLocation())` — ou `{ provide: LocationStrategy, useClass: HashLocationStrategy }` |
| Svelte | `svelte-spa-router` (paquet npm, hash par conception) |
| SolidJS | `<HashRouter>` de `@solidjs/router` (PAS `<Router>` simple) |
| Qwik | Manuel : un signal `route` dans le composant racine (Qwik City est incompatible avec les custom pages) |

### 3. Chaque appel API utilise le chemin relatif `/bonita/API/...`

Coder en dur `http://localhost:8080` casse la prod. Coder en dur l'URL de prod casse le dev. Les exemples du toolkit utilisent une seule constante de base :

```ts
const BASE = import.meta.env.VITE_BONITA_URL || '/bonita';
```

Pour Angular : même idée, utilisez une URL relative dans `HttpClient.get('/bonita/API/...')`.

### 4. `credentials: 'include'` sur chaque requête

Sans ça, les cookies `JSESSIONID` et `X-Bonita-API-Token` de Bonita ne sont pas envoyés.

| Framework | Où |
|-----------|----|
| Tous basés sur `fetch` | `fetch(url, { credentials: 'include' })` à chaque appel |
| Angular | `withCredentials: true` posé par un intercepteur HTTP — voir `examples/angular-directory-bonita/src/app/interceptors/auth.interceptor.ts` |

### 5. Token CSRF : lire le cookie, envoyer en header

Toute requête mutante (POST/PUT/DELETE) a besoin du header `X-Bonita-API-Token` reprenant la valeur du cookie du même nom :

```ts
const match = document.cookie.match(/(?:^|;\s*)X-Bonita-API-Token=([^;]*)/);
if (match) headers['X-Bonita-API-Token'] = decodeURIComponent(match[1]);
```

Certains sites le posent aussi sur les GET (sans danger et plus simple).

### 6. Layout du ZIP — `wrap` s'en charge pour vous

`page.properties` à la racine du ZIP, sortie du build sous `resources/`. Le script de packaging que `wrap` ajoute (`scripts/package-bonita.js`) gère ça automatiquement. Vous, vous lancez juste le build puis `npm run dist`.

### 7. CSP `<meta>` — attention à deux directives

Deux règles non évidentes :

- **N'incluez PAS `frame-ancestors`** dans votre `<meta http-equiv="Content-Security-Policy">`. Les navigateurs l'ignorent quand elle vient du `<meta>` et émettent un warning console. Le Tomcat de Bonita pose le bon header de réponse.
- **Pour Angular uniquement** : incluez `'unsafe-inline'` dans `script-src`. Le runtime Angular enregistre certains handlers de clic comme attributs DOM inline, traités comme des scripts inline par le navigateur. Sans `'unsafe-inline'`, tous les clics sont bloqués. React/Vue/Svelte/Solid/Qwik n'ont pas besoin de ça.

CSP meta fonctionnel pour Angular :
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self' blob:; base-uri 'self'; form-action 'self'" />
```

Pour les autres, retirez `'unsafe-inline'` après `script-src 'self'`.

### Extras Bonita 2025.x

- **Tri / filtrage de l'API REST** : le query param `o=` est parsé strictement — répétez par critère (`?o=A DESC&o=B ASC`), jamais séparé par virgule (`?o=A DESC,B ASC` retourne 500). De plus : les noms de search descriptors ≠ noms de champs de réponse, donc **dans le doute, omettez `o=`/`f=`/`d=` complètement** et triez/filtrez côté client. Le `bpm.ts` livré dans le toolkit le fait défensivement.
- **Layout Without Menu** : lors de la création de l'Application Bonita qui héberge votre page, choisissez le layout intégré `Layout Without Menu` (dans `superAdminAppBonita/application-list/`). Sinon, le layout par défaut entoure votre SPA avec la chrome Bonita.

---

## Ce que `bonita-page wrap` ajoute (pour que vous ne l'écriviez pas)

Quand vous lancez `wrap`, il crée ces fichiers à la racine de votre projet :

```
votre-projet/
├── page.properties              ← name, displayName, description, contentType
├── docs/
│   ├── DEPLOY-README.md         ← guide de déploiement pas-à-pas EN/FR/ES
│   └── DEPLOY-README.html       ← même contenu, navigable en HTML
├── scripts/
│   ├── package-bonita.js        ← Construit le ZIP avec le layout attendu par Bonita
│   └── copy-docs.js             ← Copie les DEPLOY-README à côté du ZIP
├── build.sh                     ← Une commande : install + build + dist
└── build.bat                    ← Pareil, pour Windows
```

Il modifie aussi votre `package.json` :
- Ajoute le script `dist` : `npm run build:bonita && node scripts/copy-docs.js`
- Ajoute le script `build:bonita` : `vite build && node scripts/package-bonita.js` (ou l'équivalent Angular)
- Ajoute `archiver` (et `cross-env` pour Angular) aux `devDependencies`

**Rien sous `src/` n'est touché.** Si votre code viole une des sept règles ci-dessus, `wrap` ne le corrigera pas — il imprime juste un warning. Appliquez d'abord la correction manuelle de §"Corrections manuelles par framework".

---

## Ce que `bonita-page wrap` NE touche PAS (à vous de le faire)

`wrap` est volontairement non destructif. Il NE :
- Remplace pas `BrowserRouter` par `HashRouter`
- Ajoute pas `'./'` à votre base path Vite ou Angular
- Ajoute pas `credentials: 'include'` ni un intercepteur CSRF
- Configure pas votre auth store ou session probe
- Configure pas le handler de session expirée Bonita

Pour chaque pièce manquante, allez voir le skill de votre framework dans [`skills/bonita-{framework}-app/`](../skills/) — ils ont des templates prêts-à-coller et des explications.

---

## Corrections manuelles par framework

### React + Vite

```ts
// vite.config.ts
export default defineConfig(({ command }) => ({
  base: command === 'build' ? './' : '/',
  // ...
}));
```

```tsx
// router.tsx
import { createHashRouter } from 'react-router-dom';
export const router = createHashRouter([ /* ... */ ]);
```

Pour le client API, copiez `examples/react-directory-bonita/src/api/client.ts` — c'est du `fetch` simple avec `credentials: 'include'` et la gestion du token CSRF.

### Vue 3 + Vite

```ts
// vite.config.ts
base: './',
```

```ts
// src/router/index.ts
import { createRouter, createWebHashHistory } from 'vue-router';
const router = createRouter({ history: createWebHashHistory(), routes });
```

Pour les watchers qui dépendent de l'état d'auth, utilisez `{ immediate: true }` (sinon les pages restent vides au premier rendu) :
```ts
watch(() => auth.user?.userId, (id) => { if (id) load(); }, { immediate: true });
```

### Angular 18+ standalone

```json
// angular.json — projects.<votre-app>.architect.build.options
{ "baseHref": "./" }
```

```ts
// app.config.ts
provideRouter(routes, withHashLocation()),
provideHttpClient(withInterceptors([authInterceptor])),

// CRITIQUE : sondez la session Bonita en APP_INITIALIZER, PAS dans
// AppComponent.ngOnInit, sinon le guard tourne avant la fin de la
// sonde et redirige tout le monde vers /login.
{
  provide: APP_INITIALIZER,
  useFactory: (store: AuthStore) => () => store.loadSession(),
  deps: [AuthStore],
  multi: true,
},
```

L'intercepteur HTTP pose `withCredentials` et le header CSRF — copiez `examples/angular-directory-bonita/src/app/interceptors/auth.interceptor.ts`.

CSP : incluez `'unsafe-inline'` dans `script-src` (voir §7 ci-dessus).

### Svelte 5

```ts
// vite.config.ts
base: './',
```

```svelte
<!-- App.svelte -->
<script>
  import Router from 'svelte-spa-router';
  // les routes utilisent des paths hash simples comme '/login', '/tasks/:id'
</script>
<Router {routes} />
```

Utilisez l'extension `.svelte.ts` pour tout module contenant des runes (`$state`, `$derived`).

### SolidJS + Vite

```ts
// vite.config.ts
base: './',
```

```tsx
// src/index.tsx
import { HashRouter, Route } from '@solidjs/router';
render(() => <HashRouter root={App}>{/* routes */}</HashRouter>, root);
```

Mettez TOUT le CSS dans `src/app.css`, PAS dans des blocs `<style>` à l'intérieur des composants — les composants montés plus tard (par ex. derrière un guard `<Show>`) injectent leur style trop tard et cassent le layout.

### Qwik (mode SPA)

```ts
// vite.config.ts
import { qwikVite } from '@builder.io/qwik/optimizer';
export default defineConfig({
  base: './',
  plugins: [qwikVite({ client: { outDir: 'dist' } })],
  build: { rollupOptions: { input: ['./index.html'] } },
});
```

Les fonctions async réutilisables (appelées depuis plusieurs QRLs) DOIVENT être au niveau du MODULE, PAS dans `component$()`. Qwik plante au runtime avec `X is not defined` sinon. Passez les signals à muter en paramètres :

```tsx
async function loadData(out: { items: Signal<Item[]>; loading: Signal<boolean> }) {
  out.loading.value = true;
  try { out.items.value = await api.list(); }
  finally { out.loading.value = false; }
}

export default component$(() => {
  const items = useSignal<Item[]>([]);
  const loading = useSignal(false);
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => { await loadData({ items, loading }); });
});
```

Utilisez `useVisibleTask$` (PAS `useTask$`) pour le bootstrap — `useTask$` ne se déclenche pas au premier rendu en mode SPA.

---

## Script de pré-vol (pour CI / environnements automatisés)

Un script Node qui fait échouer le build si une des sept règles est violée :

```bash
# Depuis la racine de votre projet
bonita-page check

# Sortie en cas de succès
{
  "ok": true,
  "framework": "react",
  "checks": {
    "buildOutputExists": true,
    "relativeBasePath": true,
    "hashRouting": true,
    "credentialsInclude": true
  }
}

# Sortie avec problèmes (exit code 1)
{
  "ok": false,
  "framework": "react",
  "issues": [
    "vite.config.ts: `base` n'est pas './' (ni computed pour build). Les assets déployés feront 404.",
    "src/router.tsx: createBrowserRouter trouvé — utilisez createHashRouter pour que le refresh survive dans Bonita."
  ]
}
```

Utilisez-le en CI :
```yaml
- run: npm run build
- run: npx bonita-page check     # bloque le merge de la PR si la config dérive
```

---

## Après que votre projet ait passé la checklist

```bash
bonita-page wrap \
    --framework=react \
    --name=invoiceDashboard \
    --display-name="Tableau de factures" \
    --app-token=invoiceApp

# Wrap encapsule sur place. Ensuite :
npm install                     # récupère archiver et toute nouvelle devDep
npm run dist                    # build + packaging + écriture des docs de déploiement
# → dist/page-invoiceDashboard.zip + dist/DEPLOY-README.{md,html}
```

Transmettez le ZIP + les DEPLOY-README à la personne qui déploie sur Bonita. Elle suit le guide de déploiement bilingue pas-à-pas dans `dist/DEPLOY-README.html` — sans IA, sans Internet, juste un navigateur.

---

## Pourquoi ce format sert aussi aux flux IA

Quand un agent IA (Claude avec les MCP tools) wrap un projet, il suit les mêmes vérifications préalables qu'un humain. Chaque règle ci-dessus mappe sur un des warnings émis par `wrap.js` et `check.js`. L'agent n'a pas à redécouvrir les règles — il lit cette checklist, lance le script de vérification, et sait quoi (s'il y a quelque chose) demander à l'utilisateur.

En pratique cela signifie :
- **Moins de coût en tokens** — l'agent vérifie une liste finie au lieu de chercher exploratoirement
- **Reproductible entre exécutions** — mêmes entrées, mêmes sorties, quelle que soit la version du modèle
- **Auditable** — le rapport JSON lisible dit à l'utilisateur exactement pourquoi le wrap a réussi ou pas

Si vous écrivez votre propre agent IA pour empaqueter des SPAs en custom pages Bonita, pointez-le vers ce document et les fichiers de skill dans `skills/`. La connaissance du skill + cette checklist + le code CLI dans `scripts/` est le contrat complet dont l'agent a besoin.
