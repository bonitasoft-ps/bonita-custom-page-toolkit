# Deploy / Déployer / Desplegar — `page-appDirectoryBonitaAngularHome.zip`

Bonita 2025.x custom page deployment guide.
Guide de déploiement d'une custom page Bonita 2025.x.
Guía de despliegue de una custom page de Bonita 2025.x.

---

## English

### What you have

- `page-appDirectoryBonitaAngularHome.zip` — the Bonita custom page (an Angular SPA)
- This README and its HTML version (informational, do NOT upload to Bonita)

### Prerequisites

- A running Bonita 2025.x instance
- An admin user (`install` / `install` for the Bonita Studio default)
- The host and port of your Bonita instance (example: `http://localhost:8080`)

### Step 1 — Login

Open in your browser:

```
http://localhost:8080/bonita/login.jsp
```

Sign in with admin credentials. Replace `localhost:8080` with your own host:port.

### Step 2 — Upload the page resource

Open the resource list (Super Admin app):

```
http://localhost:8080/bonita/apps/superAdminAppBonita/resource-list/
```

> Tenant admin equivalent: `/bonita/apps/adminAppEEBonita/admin-resource-list/`

Click **+ Add a resource**, select `page-appDirectoryBonitaAngularHome.zip`, confirm.
The page now appears in the list with displayName `Directory Bonita Angular Home`.

### Step 3 — Create a new application

Open the application list:

```
http://localhost:8080/bonita/apps/superAdminAppBonita/application-list/
```

Click **+ Create application**. Fill:

| Field | Value |
|-------|-------|
| Token | `appDirectoryBonitaAngular` |
| Display name | `Directory Bonita Angular` |
| Description | (your description) |
| Profile | the profile your test users have |
| **Layout** | **`Layout Without Menu`** ← IMPORTANT |

Why `Layout Without Menu`: the default Bonita layout wraps every page with a header and a side menu. For a full-screen SPA you must select **Layout Without Menu** so the page fills the entire viewport. This is the most common cause of "the app is squeezed inside the Bonita admin chrome".

Save. Note the application's `id` (you'll need it next; it appears in the URL after saving, e.g. `id=14`).

### Step 4 — Bind the page to the application

Open:

```
http://localhost:8080/bonita/apps/superAdminAppBonita/admin-application-details/?id={id}
```

(replace `{id}` with the id you just got)

In the **Pages** section:
1. Click **+ Add page**
2. Select `Directory Bonita Angular Home`
3. Set the **Token** to `home`
4. Save
5. Optionally mark it as the application's **Home page**

### Step 5 — Open the application

Open in your browser:

```
http://localhost:8080/bonita/apps/appDirectoryBonitaAngular/home/?_l=en
```

If everything is correct, the Angular SPA loads, auto-detects your Bonita session, and shows the task list. **Listo.**

### Updating the page later

Build a new ZIP with the same `page.properties.name`. Upload it via the same resource-list URL — Bonita prompts to replace it. Application bindings are preserved. Force-refresh (Ctrl+F5) to bust the browser cache.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `/bonita/portal/admin` → 404 | Old Portal is gone in 2025.x. Use the URLs above. |
| Resource-list is empty / 403 | Your user lacks Admin / Super Admin profile. Login as `install` (Studio) or grant the right profile. |
| Page imports OK but `/bonita/apps/appDirectoryBonitaAngular/home/` 404s | Check (a) Application token spelling, (b) Page token = `home`, (c) Your user has the application's profile. |
| App loads but is wrapped by Bonita admin chrome | You picked the default layout. Edit the application → set Layout to **Layout Without Menu**. |
| Blank screen | Browser cache — Ctrl+F5. Or wrong build (verify `unzip -l` shows `page.properties` at root and `resources/index.html`). |
| HTTP 500 on `/API/bpm/humanTask` | Already fixed in this build (use `o=...&o=...` not `o=A,B`). If it persists, check the URL in DevTools — should be `&o=priority+DESC&o=dueDate+ASC`. |

---

## Français

### Contenu de la livraison

- `page-appDirectoryBonitaAngularHome.zip` — la custom page Bonita (SPA Angular)
- Ce README et sa version HTML (informatifs, ne PAS uploader dans Bonita)

### Prérequis

- Une instance Bonita 2025.x démarrée
- Un utilisateur administrateur (`install` / `install` pour Bonita Studio)
- Le host et le port de votre Bonita (exemple : `http://localhost:8080`)

### Étape 1 — Connexion

Ouvrez dans le navigateur :

```
http://localhost:8080/bonita/login.jsp
```

Connectez-vous avec les identifiants administrateur. Remplacez `localhost:8080` par votre host:port.

### Étape 2 — Uploader la page

Ouvrez la liste des ressources (Super Admin) :

```
http://localhost:8080/bonita/apps/superAdminAppBonita/resource-list/
```

> Équivalent Admin tenant : `/bonita/apps/adminAppEEBonita/admin-resource-list/`

Cliquez sur **+ Ajouter une ressource**, sélectionnez `page-appDirectoryBonitaAngularHome.zip`, validez.
La page apparaît avec le nom `Directory Bonita Angular Home`.

### Étape 3 — Créer une nouvelle application

Ouvrez la liste des applications :

```
http://localhost:8080/bonita/apps/superAdminAppBonita/application-list/
```

Cliquez sur **+ Créer une application**. Renseignez :

| Champ | Valeur |
|-------|--------|
| Token | `appDirectoryBonitaAngular` |
| Display name | `Directory Bonita Angular` |
| Description | (votre description) |
| Profile | le profil dont disposent vos utilisateurs de test |
| **Layout** | **`Layout Without Menu`** ← IMPORTANT |

Pourquoi `Layout Without Menu` : le layout Bonita par défaut entoure chaque page d'un header et d'un menu latéral. Pour une SPA en plein écran, vous **devez** sélectionner **Layout Without Menu** afin que la page occupe toute la fenêtre. C'est la cause la plus fréquente du symptôme « l'application est compressée dans la chrome admin de Bonita ».

Sauvegardez. Notez l'`id` de l'application (visible dans l'URL après la sauvegarde, ex. `id=14`).

### Étape 4 — Lier la page à l'application

Ouvrez :

```
http://localhost:8080/bonita/apps/superAdminAppBonita/admin-application-details/?id={id}
```

(remplacez `{id}` par l'id obtenu)

Dans la section **Pages** :
1. Cliquez sur **+ Ajouter une page**
2. Sélectionnez `Directory Bonita Angular Home`
3. Renseignez le **Token** : `home`
4. Sauvegardez
5. Optionnel : marquez-la comme **page d'accueil** de l'application

### Étape 5 — Ouvrir l'application

Ouvrez dans le navigateur :

```
http://localhost:8080/bonita/apps/appDirectoryBonitaAngular/home/?_l=fr
```

Si tout est correct, la SPA Angular se charge, détecte automatiquement la session Bonita et affiche la liste des tâches. **C'est terminé.**

### Mettre à jour la page

Construisez un nouveau ZIP avec le même `page.properties.name`. Uploadez-le via la même URL resource-list — Bonita propose de le remplacer. Les liaisons à l'application sont préservées. Faites un rafraîchissement forcé (Ctrl+F5) pour vider le cache navigateur.

### Dépannage

| Symptôme | Solution |
|----------|----------|
| `/bonita/portal/admin` → 404 | L'ancien Portal n'existe plus en 2025.x. Utilisez les URLs ci-dessus. |
| Resource-list vide / 403 | Votre utilisateur n'a pas le profil Admin / Super Admin. Connectez-vous en `install` (Studio) ou attribuez le bon profil. |
| Page importée mais `/bonita/apps/appDirectoryBonitaAngular/home/` 404 | Vérifiez (a) l'orthographe du token application, (b) le token de la page = `home`, (c) votre utilisateur a bien le profil de l'application. |
| L'app se charge mais entourée du chrome admin | Vous avez choisi le layout par défaut. Éditez l'application → Layout = **Layout Without Menu**. |
| Écran blanc | Cache navigateur — Ctrl+F5. Ou mauvais build (vérifiez avec `unzip -l` que `page.properties` est à la racine et `resources/index.html` présent). |
| HTTP 500 sur `/API/bpm/humanTask` | Déjà corrigé dans ce build (`o=...&o=...` au lieu de `o=A,B`). Si ça persiste, inspectez l'URL dans DevTools — elle doit contenir `&o=priority+DESC&o=dueDate+ASC`. |

---

## Castellano

### Qué contiene la entrega

- `page-appDirectoryBonitaAngularHome.zip` — la custom page de Bonita (SPA Angular)
- Este README y su versión HTML (informativos, NO subir a Bonita)

### Requisitos previos

- Una instancia de Bonita 2025.x en ejecución
- Un usuario administrador (`install` / `install` por defecto en Bonita Studio)
- El host y el puerto de tu Bonita (ejemplo: `http://localhost:8080`)

### Paso 1 — Iniciar sesión

Abre en el navegador:

```
http://localhost:8080/bonita/login.jsp
```

Inicia sesión con credenciales de administrador. Sustituye `localhost:8080` por tu propio host:puerto.

### Paso 2 — Subir el ZIP de la página

Abre la lista de recursos (Super Admin):

```
http://localhost:8080/bonita/apps/superAdminAppBonita/resource-list/
```

> Equivalente Admin tenant: `/bonita/apps/adminAppEEBonita/admin-resource-list/`

Haz clic en **+ Añadir un recurso**, selecciona `page-appDirectoryBonitaAngularHome.zip`, confirma.
La página aparece en la lista con el nombre `Directory Bonita Angular Home`.

### Paso 3 — Crear una nueva aplicación

Abre la lista de aplicaciones:

```
http://localhost:8080/bonita/apps/superAdminAppBonita/application-list/
```

Haz clic en **+ Crear aplicación**. Rellena:

| Campo | Valor |
|-------|-------|
| Token | `appDirectoryBonitaAngular` |
| Nombre visible | `Directory Bonita Angular` |
| Descripción | (tu descripción) |
| Perfil | el perfil que tienen tus usuarios de prueba |
| **Layout** | **`Layout Without Menu`** ← IMPORTANTE |

Por qué `Layout Without Menu`: el layout Bonita por defecto envuelve cada página con un header y un menú lateral. Para una SPA a pantalla completa **debes** seleccionar **Layout Without Menu** para que la página ocupe toda la ventana. Este es el motivo más frecuente del síntoma "la aplicación aparece comprimida dentro del chrome de admin de Bonita".

Guarda. Anota el `id` de la aplicación (aparece en la URL tras guardar, p. ej. `id=14`).

### Paso 4 — Vincular la página a la aplicación

Abre:

```
http://localhost:8080/bonita/apps/superAdminAppBonita/admin-application-details/?id={id}
```

(sustituye `{id}` por el id obtenido)

En la sección **Pages** (páginas):
1. Haz clic en **+ Añadir página**
2. Selecciona `Directory Bonita Angular Home`
3. Pon el **Token** a `home`
4. Guarda
5. Opcional: marca esta página como **página de inicio** de la aplicación

### Paso 5 — Abrir la aplicación

Abre en el navegador:

```
http://localhost:8080/bonita/apps/appDirectoryBonitaAngular/home/?_l=es
```

Si todo está bien, la SPA Angular se carga, detecta automáticamente la sesión de Bonita y muestra la lista de tareas. **Listo.**

### Actualizar la página después

Construye un nuevo ZIP con el mismo `page.properties.name`. Súbelo por la misma URL resource-list — Bonita pregunta si quieres reemplazarlo. Los vínculos con la aplicación se conservan. Haz refresco forzado (Ctrl+F5) para limpiar la caché del navegador.

### Resolución de problemas

| Síntoma | Solución |
|---------|----------|
| `/bonita/portal/admin` → 404 | El Portal antiguo desapareció en 2025.x. Usa las URLs de arriba. |
| Resource-list vacía / 403 | Tu usuario no tiene el perfil Admin / Super Admin. Inicia sesión como `install` (Studio) o solicita el perfil correcto. |
| Página importada pero `/bonita/apps/appDirectoryBonitaAngular/home/` 404 | Comprueba (a) el token de la aplicación, (b) que el token de la página sea `home`, (c) que tu usuario tenga el perfil de la aplicación. |
| La app carga pero envuelta en el chrome admin | Elegiste el layout por defecto. Edita la aplicación → Layout = **Layout Without Menu**. |
| Pantalla en blanco | Caché del navegador — Ctrl+F5. O build defectuoso (verifica con `unzip -l` que `page.properties` está en la raíz y existe `resources/index.html`). |
| HTTP 500 en `/API/bpm/humanTask` | Ya corregido en este build (usa `o=...&o=...` en lugar de `o=A,B`). Si persiste, inspecciona la URL en DevTools — debe contener `&o=priority+DESC&o=dueDate+ASC`. |

---

_Generated by `npm run dist` from `examples/react-directory-bonita/`._
