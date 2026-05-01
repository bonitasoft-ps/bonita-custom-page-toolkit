# Checklist previa: cómo preparar tu proyecto para `bonita-page wrap`

> Idiomas / Languages / Langues: **[Castellano (este documento)]** · [English](WRAP-CHECKLIST.md) · [Français](WRAP-CHECKLIST.fr.md)

Este documento está pensado para **desarrolladores que ya tienen un proyecto React / Vue / Angular / Svelte / SolidJS / Qwik** y quieren empaquetarlo como una Bonita custom page usando el comando `bonita-page wrap` del toolkit.

Te dice exactamente qué debe cumplir tu proyecto **antes** de ejecutar `wrap`, para que el paso `wrap` funcione y el ZIP se despliegue limpiamente en Bonita 2025.x sin que la IA tenga que intervenir.

> **Por qué existe.** `bonita-page wrap` solo añade la capa Bonita (`page.properties`, script de empaquetado, guías de despliegue, scripts de build). NO modifica tu código en `src/`. Si tu proyecto no cumple las reglas siguientes, el `wrap` se ejecutará pero el ZIP desplegado fallará en runtime. La vía rápida es arreglar los problemas en `src/` primero, después hacer `wrap`.

---

## Camino exprés (un solo comando)

Si tu equipo confía en que el proyecto cumple las reglas, puedes saltarte la verificación manual y usar el orquestador:

```bash
cd /ruta/a/tu/proyecto
/ruta/a/bonita-custom-page-toolkit/bonita-page.sh prepare \
    --name=miPanel \
    --app-token=miApp
# → ejecuta: check, wrap, npm install, npm run dist
# → al final tienes dist/page-miPanel.zip + DEPLOY-README.{md,html}
```

Si `prepare` aborta en la fase `check`, sabrás exactamente qué arreglar (el comando lista los problemas y se detiene). Aplica los `Arreglos manuales por framework` de la sección de abajo y vuelve a lanzar.

Si prefieres ejecutar los pasos uno a uno (más control, mismo resultado):

```bash
bonita-page check                                # 1. Verifica
bonita-page wrap --name=miPanel --app-token=miApp  # 2. Añade capa Bonita
npm install                                      # 3. Dependencias
npm run dist                                     # 4. Construye ZIP
```

---

## TL;DR — la verificación de 8 líneas

Ejecuta esto en la raíz de tu proyecto. Si todo pasa, ya estás listo para `wrap`:

```bash
# 1. El proyecto compila. (Adapta si tu script se llama distinto.)
npm run build

# 2. El build emite un único index.html y una carpeta de assets con hash.
ls dist                 # frameworks Vite
ls dist/<app>/browser   # Angular

# 3. El index.html del build usa rutas RELATIVAS (./assets/...) NO (/assets/...)
grep -o 'src="[^"]*"' dist/index.html | head -3   # debe empezar por "./"

# 4. Tu enrutamiento usa modo HASH (sin 404 al refrescar dentro de Bonita).
#    Busca uno de:
grep -rE "createHashRouter|HashRouter|createWebHashHistory|HashLocationStrategy|svelte-spa-router|@solidjs/router.*HashRouter" src/

# 5. Cada fetch / HttpClient envía credenciales + el token CSRF.
#    Busca alguno de estos en tu capa HTTP:
grep -rE "credentials: ['\"]include|withCredentials|X-Bonita-API-Token" src/
```

Si 1-3 fallan → ver §"Arreglos manuales por framework" más abajo. 4-5 → ver §"Lo que `wrap` NO toca".

Para una versión automatizada de esta verificación:

```bash
bonita-page check         # exit 0 si pasa, exit 1 + JSON con problemas si no
```

---

## Lo que tu proyecto debe cumplir (las siete reglas + extras de Bonita 2025.x)

Estas reglas son universales para los seis frameworks soportados. Saltarse cualquiera produce un ZIP que compila pero falla en runtime.

### 1. Build con rutas base relativas

Bonita sirve tu custom page desde una URL anidada profunda como `/bonita/portal/resource/page/{profile}/{name}/content/`. Las rutas absolutas (`/assets/index.js`) resuelven a `/assets/...` — fuera del directorio de la página — y dan 404.

| Framework | Dónde | Valor |
|-----------|-------|-------|
| Vite (React/Vue/Svelte/Solid/Qwik) | `vite.config.ts` → `base` | `'./'` (o `command === 'build' ? './' : '/'`) |
| Angular | `angular.json` → `architect.build.options.baseHref` | `'./'` |

**Cómo verificar**: abre `dist/index.html` (o `dist/<app>/browser/index.html` para Angular) tras un build. Las etiquetas `<script src="...">` y `<link href="...">` deben empezar por `./` (o ser nombres simples). Si empiezan por `/`, el build está mal.

### 2. Hash routing, nunca enrutamiento browser/HTML5

El Tomcat de Bonita no reescribe URLs desconocidas a `index.html`. Con browser routing, refrescar `/tasks/123` da 404 porque Tomcat busca un recurso literal `tasks/123`.

| Framework | Qué usar |
|-----------|----------|
| React | `createHashRouter` de `react-router-dom` v7 (NO `createBrowserRouter`) |
| Vue | `createWebHashHistory()` (NO `createWebHistory()`) |
| Angular | `provideRouter(routes, withHashLocation())` — o `{ provide: LocationStrategy, useClass: HashLocationStrategy }` |
| Svelte | `svelte-spa-router` (paquete npm, hash por diseño) |
| SolidJS | `<HashRouter>` de `@solidjs/router` (NO `<Router>` plano) |
| Qwik | Manual: una signal `route` en tu componente raíz (Qwik City es incompatible con custom pages) |

### 3. Cada llamada API usa la ruta relativa `/bonita/API/...`

Hardcodear `http://localhost:8080` rompe producción. Hardcodear la URL de producción rompe dev. Los ejemplos del toolkit usan una constante única:

```ts
const BASE = import.meta.env.VITE_BONITA_URL || '/bonita';
```

Para Angular: misma idea, usa una URL relativa en `HttpClient.get('/bonita/API/...')`.

### 4. `credentials: 'include'` en cada petición

Sin esto, las cookies `JSESSIONID` y `X-Bonita-API-Token` de Bonita no se envían.

| Framework | Dónde |
|-----------|-------|
| Todos los basados en `fetch` | `fetch(url, { credentials: 'include' })` en cada llamada |
| Angular | `withCredentials: true` puesto por un interceptor HTTP — ver `examples/angular-directory-bonita/src/app/interceptors/auth.interceptor.ts` |

### 5. Token CSRF: leer de la cookie, enviar en cabecera

Toda petición que muta (POST/PUT/DELETE) necesita la cabecera `X-Bonita-API-Token` con el mismo valor que la cookie:

```ts
const match = document.cookie.match(/(?:^|;\s*)X-Bonita-API-Token=([^;]*)/);
if (match) headers['X-Bonita-API-Token'] = decodeURIComponent(match[1]);
```

Algunos sitios también lo ponen en GET (es inocuo y más simple).

### 6. Estructura del ZIP — `wrap` lo aplica por ti

`page.properties` en la raíz del ZIP, salida del build bajo `resources/`. El script de empaquetado que añade `wrap` (`scripts/package-bonita.js`) lo gestiona automáticamente. Tú solo ejecutas el build y luego `npm run dist`.

### 7. CSP `<meta>` — cuidado con dos directivas

Dos reglas no obvias:

- **No incluyas `frame-ancestors`** en tu `<meta http-equiv="Content-Security-Policy">`. Los navegadores la ignoran cuando viene del `<meta>` y emiten un warning en consola. Bonita Tomcat ya pone la cabecera HTTP adecuada.
- **Solo en Angular**: incluye `'unsafe-inline'` en `script-src`. El runtime de Angular registra algunos handlers de click como atributos DOM inline que el navegador trata como scripts inline. Sin `'unsafe-inline'`, todos los clics se bloquean. React/Vue/Svelte/Solid/Qwik no necesitan esto.

CSP meta funcional para Angular:
```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self' blob:; base-uri 'self'; form-action 'self'" />
```

Para los demás, quita el `'unsafe-inline'` después de `script-src 'self'`.

### Extras de Bonita 2025.x

- **Ordenación / filtrado de la API REST**: el query param `o=` se parsea estricto — repite por criterio (`?o=A DESC&o=B ASC`), nunca con coma (`?o=A DESC,B ASC` devuelve 500). Además: los nombres de search descriptor ≠ nombres de campos de respuesta, así que **cuando dudes, omite `o=`/`f=`/`d=` por completo** y ordena/filtra en el cliente. El `bpm.ts` que viene en el toolkit lo hace defensivamente.
- **Layout Without Menu**: al crear la Aplicación Bonita que aloja tu página, elige el layout integrado `Layout Without Menu` (en `superAdminAppBonita/application-list/`). Si no, el layout por defecto envuelve tu SPA con la chrome de Bonita.

---

## Lo que `bonita-page wrap` añade (para que tú no lo escribas)

Cuando ejecutas `wrap`, crea estos ficheros en la raíz de tu proyecto:

```
tu-proyecto/
├── page.properties              ← name, displayName, description, contentType
├── docs/
│   ├── DEPLOY-README.md         ← guía de despliegue paso a paso EN/FR/ES
│   └── DEPLOY-README.html       ← mismo contenido, navegable en HTML
├── scripts/
│   ├── package-bonita.js        ← Construye el ZIP con el layout que Bonita espera
│   └── copy-docs.js             ← Copia los DEPLOY-README junto al ZIP
├── build.sh                     ← Un comando: install + build + dist
└── build.bat                    ← Igual, para Windows
```

También modifica tu `package.json`:
- Añade script `dist`: `npm run build:bonita && node scripts/copy-docs.js`
- Añade script `build:bonita`: `vite build && node scripts/package-bonita.js` (o el equivalente Angular)
- Añade `archiver` (y `cross-env` para Angular) a `devDependencies`

**Nada bajo `src/` se toca.** Si tu código viola alguna de las siete reglas anteriores, `wrap` no lo arregla — solo imprime un aviso. Aplica el arreglo manual de §"Arreglos manuales por framework" primero.

---

## Lo que `bonita-page wrap` NO toca (te toca a ti)

`wrap` es deliberadamente no destructivo. NO:
- Reemplaza `BrowserRouter` por `HashRouter`
- Añade `'./'` a tu base path de Vite o Angular
- Añade `credentials: 'include'` ni un interceptor CSRF
- Configura tu auth store o session probe
- Configura el handler de session-expired de Bonita

Para cada pieza que falte, ve al skill de tu framework en [`skills/bonita-{framework}-app/`](../skills/) — tienen plantillas listas para pegar y explicaciones.

---

## Arreglos manuales por framework

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

Para el cliente API, copia `examples/react-directory-bonita/src/api/client.ts` — es `fetch` plano con `credentials: 'include'` y manejo de token CSRF.

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

Para watchers que dependen del estado de auth, usa `{ immediate: true }` (si no, las páginas se quedan vacías al primer render):
```ts
watch(() => auth.user?.userId, (id) => { if (id) load(); }, { immediate: true });
```

### Angular 18+ standalone

```json
// angular.json — projects.<tu-app>.architect.build.options
{ "baseHref": "./" }
```

```ts
// app.config.ts
provideRouter(routes, withHashLocation()),
provideHttpClient(withInterceptors([authInterceptor])),

// CRÍTICO: prueba la sesión Bonita como APP_INITIALIZER, NO en
// AppComponent.ngOnInit, si no el guard se ejecuta antes de que termine
// la prueba y tira a todo el mundo a /login.
{
  provide: APP_INITIALIZER,
  useFactory: (store: AuthStore) => () => store.loadSession(),
  deps: [AuthStore],
  multi: true,
},
```

El interceptor HTTP pone `withCredentials` y la cabecera CSRF — copia `examples/angular-directory-bonita/src/app/interceptors/auth.interceptor.ts`.

CSP: incluye `'unsafe-inline'` en `script-src` (ver §7 arriba).

### Svelte 5

```ts
// vite.config.ts
base: './',
```

```svelte
<!-- App.svelte -->
<script>
  import Router from 'svelte-spa-router';
  // las rutas usan paths hash simples como '/login', '/tasks/:id'
</script>
<Router {routes} />
```

Usa la extensión `.svelte.ts` para cualquier módulo que contenga runas (`$state`, `$derived`).

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

Pon TODO el CSS en `src/app.css`, NO en bloques `<style>` dentro de componentes — los componentes que se montan más tarde (p. ej. tras un guard `<Show>`) inyectan sus estilos demasiado tarde y rompen el layout.

### Qwik (modo SPA)

```ts
// vite.config.ts
import { qwikVite } from '@builder.io/qwik/optimizer';
export default defineConfig({
  base: './',
  plugins: [qwikVite({ client: { outDir: 'dist' } })],
  build: { rollupOptions: { input: ['./index.html'] } },
});
```

Las funciones async reutilizables (llamadas desde varios QRLs) DEBEN estar a nivel de MÓDULO, NO dentro de `component$()`. Qwik falla en runtime con `X is not defined` si no. Pasa las signals que necesites mutar como parámetros:

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

Usa `useVisibleTask$` (NO `useTask$`) para el bootstrap — `useTask$` no se dispara en el primer render en modo SPA.

---

## Script de pre-vuelo (para CI / entornos automatizados)

Un script Node que falla el build si se viola alguna de las siete reglas:

```bash
# Desde la raíz de tu proyecto
bonita-page check

# Salida en caso de éxito
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

# Salida con problemas (exit code 1)
{
  "ok": false,
  "framework": "react",
  "issues": [
    "vite.config.ts: `base` no es './' (ni computed para build). Los assets desplegados darán 404.",
    "src/router.tsx: createBrowserRouter encontrado — usa createHashRouter para que el refresh sobreviva en Bonita."
  ]
}
```

Úsalo en CI:
```yaml
- run: npm run build
- run: npx bonita-page check     # bloquea el merge del PR si la config se desvía
```

---

## Después de que tu proyecto pase la checklist

```bash
bonita-page wrap \
    --framework=react \
    --name=invoiceDashboard \
    --display-name="Panel de facturas" \
    --app-token=invoiceApp

# Wrap envuelve in-place. Después:
npm install                     # incluye archiver y cualquier devDep nueva
npm run dist                    # build + empaquetado + escribe los docs de despliegue
# → dist/page-invoiceDashboard.zip + dist/DEPLOY-README.{md,html}
```

Pasa el ZIP + los DEPLOY-README a quien despliegue en Bonita. Sigue la guía bilingüe paso a paso en `dist/DEPLOY-README.html` — sin IA, sin Internet, solo un navegador.

---

## Por qué este formato sirve también para flujos con IA

Cuando un agente IA (Claude con las MCP tools) envuelve un proyecto, sigue las mismas verificaciones previas que un humano. Cada regla de arriba mapea a uno de los warnings emitidos por `wrap.js` y `check.js`. El agente no tiene que redescubrir las reglas — lee este checklist, ejecuta el script de verificación, y sabe qué (si algo) preguntar al usuario.

En la práctica esto significa:
- **Menor coste de tokens** — el agente verifica una lista finita en vez de buscar exploratoriamente
- **Reproducible entre ejecuciones** — mismo input, mismo output, sea cual sea la versión del modelo
- **Auditable** — el reporte JSON legible le dice al usuario exactamente por qué `wrap` tuvo éxito o no

Si vas a escribir tu propio agente IA que envuelva SPAs como custom pages de Bonita, apúntalo a este documento y a los archivos de skill en `skills/`. El conocimiento del skill + esta checklist + el código del CLI en `scripts/` es el contrato completo que el agente necesita.
