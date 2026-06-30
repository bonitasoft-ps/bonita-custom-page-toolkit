# Custom Page Deployment Gotchas (Bonita REST + Living Applications)

Hard-won lessons from deploying React/SPA custom pages to a running Bonita
runtime (2025.x) via REST, inside a Living Application. Following these avoids
three recurring failures. Apply them in the deployment guide, the deploy
scripts, and any MCP tool that deploys pages.

## 1. Always use "Layout Without Menu" for SPA pages

A React/Vue/Angular SPA custom page brings its own header, sidebar and
navigation. If the hosting Living Application uses the default layout
(`custompage_layoutBonita`), Bonita renders its own top bar + (empty) menu band
**on top of** the SPA, producing a duplicated, unprofessional header.

- Use **`custompage_layoutWithoutMenuBonita`** ("Layout Without Menu") for any
  application that hosts a full SPA page.
- Caveat: `CreateApplicationRequest` has **no layout field**, so you cannot set
  the layout when creating the application via REST. A `PUT` of `layoutId` on an
  already-created application **may not persist** on some versions.
- Reliable approach: set the layout in the **application descriptor in Bonita
  Studio** when the app is created (choose "Layout Without Menu"), or recreate
  the application with that layout if the version supports it via REST.

## 2. The page-create REST field is `pageZip`, not `contentName`

Two-step upload + create:

```bash
# 1) upload the built ZIP -> returns "uuid.zip::original.zip::[]"
UP=$(curl -s -b cookies -H "X-Bonita-API-Token: $TOK" \
     -F "file=@page-myApp.zip" "$BONITA/portal/pageUpload")
TMP=$(echo "$UP" | awk -F'::' '{print $1}')   # -> uuid.zip

# 2) create the page (correct field is pageZip)
curl -s -b cookies -H "X-Bonita-API-Token: $TOK" -H "Content-Type: application/json" \
     -X POST "$BONITA/API/portal/page" --data "{\"pageZip\":\"$TMP\"}"
```

Using `{"contentName": "..."}` fails with:

```
java.lang.NullPointerException: Cannot invoke "String.split(String)" because "zipFileAttribute" is null
```

The schema is `PageCreateRequest { pageZip }` (and `PageUpdateRequest { pageZip }`).

## 3. Home page mapping: create your own token, set it home, then delete the default

When you create a Living Application, Bonita auto-creates a `home`
application-page pointing to a **default** page. So:

- Mapping your page with token `home` fails: `AlreadyExistsException: An
  application page with token 'home' already exists`.
- You **cannot delete** the `home` application-page while it is still the
  application's home page (`DELETE` returns 500).

Correct sequence:

```bash
# create your page mapping under a different token (e.g. "inicio")
AP=$(curl ... -X POST "$BONITA/API/living/application-page" \
     --data '{"applicationId":"'$APPID'","pageId":"'$PAGEID'","token":"inicio"}')
NID=$(echo "$AP" | jq -r .id)

# set it as the application home page
curl ... -X PUT "$BONITA/API/living/application/$APPID" --data '{"homePageId":"'$NID'"}'

# now the default 'home' mapping is no longer the home -> it can be deleted
HID=$(curl ... "$BONITA/API/living/application-page?f=applicationId%3d$APPID" | jq -r '.[]|select(.token=="home").id')
curl ... -X DELETE "$BONITA/API/living/application-page/$HID"
```

The app then serves your SPA at `/$BONITA/apps/<appToken>/` (redirects to the
home token).

## Quick deploy checklist

1. Build the ZIP (`page.properties` at root + `resources/`). Validate layout.
2. Login, capture `X-Bonita-API-Token` cookie, send it as header on writes.
3. `POST /portal/pageUpload` -> take the first `::` token.
4. `POST /API/portal/page` with `{"pageZip": "<tmp>"}`.
5. Create the Living Application (legacy app, `link:false`).
6. Map your page under a custom token, set it as `homePageId`, delete the
   default `home` mapping.
7. Ensure the app uses **Layout Without Menu** (set in Studio descriptor).
8. Grant access: map the app to a profile and the demo users to that profile.

> A reference implementation of this flow lives in the CTAIMA POC repo at
> `entorno/deploy-page.sh`. Mirror it here when wiring the toolkit's deploy MCP
> tool.
