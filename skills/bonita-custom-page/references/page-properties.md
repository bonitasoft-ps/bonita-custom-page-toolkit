# `page.properties` — the Bonita page descriptor

A plain `key=value` text file at the ZIP root. Bonita reads it to register the resource.

## Minimal template

```properties
name=custompage_taskViewer
displayName=Task Viewer
description=Custom page showing the user's pending tasks
contentType=page
```

## Fields

| Key | Required | Format | Notes |
|-----|----------|--------|-------|
| `name` | Yes | `custompage_<camelCase>` | Internal identifier. Must start with `custompage_`. No spaces, no dashes, no special chars. |
| `displayName` | Yes | Free text | Shown in Bonita Admin and as the page label. |
| `description` | Recommended | Free text | Shown in Bonita Admin only. |
| `contentType` | Yes | `page` \| `layout` \| `theme` \| `apiExtension` \| `form` | `page` for SPAs. `layout` for Bonita Portal layouts. |

## Naming the `name` field

The `name` is the technical identifier Bonita uses to:
- Store the resource on disk
- Construct the URL path (`/bonita/portal/resource/page/{profile}/{name}/content/`)
- Identify the page when adding it to an Application

Rules:
- Must start with `custompage_`
- After the prefix, use **camelCase** (Bonita convention)
- Allowed: `[A-Za-z0-9_]`
- NOT allowed: spaces, hyphens, dots, accents
- Examples: `custompage_taskViewer`, `custompage_invoiceDashboard`, `custompage_adminConsole`

When you upload a ZIP whose `page.properties.name` matches an existing resource, Bonita **replaces** it. This is how you deploy updates — same name, same identity.

## Optional fields you may see

These are auto-managed by Bonita (it adds them when it imports your ZIP). Safe to omit:

```properties
resourceId=...           # Internal numeric ID
provided=false           # true for built-in pages
edition=Community        # Auto-detected
contentName=page-...zip  # Filename echo
```

## Examples by app type

### Task list page

```properties
name=custompage_taskViewer
displayName=My Tasks
description=Inbox of human tasks for the current user
contentType=page
```

### Admin dashboard

```properties
name=custompage_adminDashboard
displayName=Administration
description=System metrics and process supervision
contentType=page
```

### Form page (used inside a process step)

```properties
name=custompage_invoiceForm
displayName=Invoice Form
description=Form for the invoice review task
contentType=form
```

`contentType=form` makes the page available in Bonita Studio's "Forms" picker, so it can be assigned to a human task's form mapping.

## Where to put `page.properties` in your project

Keep it at the project root, **outside** `src/` (the SPA build output). The packaging script reads it from there and copies it into the ZIP root.

```
my-app/
├── page.properties        ← Source of truth
├── src/                   ← App source (NOT in ZIP root)
├── dist/                  ← Build output (becomes resources/)
└── scripts/
    └── package-bonita.js  ← Reads page.properties → writes ZIP
```

## Editing in Bonita Admin (rarely)

Bonita Admin lets you edit the displayName/description after upload, but the `name` is immutable. To rename a page, delete the old resource and upload with the new name (you'll lose its application bindings).

## Troubleshooting

| Error in Bonita logs | Cause |
|---------------------|-------|
| `name field is mandatory` | Missing `name=` line |
| `page name must start with custompage_` | Forgot the prefix |
| `Invalid character in page name` | Used a space, dash, or dot |
| `contentType is mandatory` | Missing `contentType=` line |
| `Unknown contentType: foo` | Typo. Check the allowed values above. |
