# Bonita REST APIs — catalog for SPA development

All endpoints are under `/bonita/API/...` and require `credentials: 'include'`. Mutating endpoints additionally require the `X-Bonita-API-Token` header (see `auth-csrf.md`).

## Session & auth

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/bonita/loginservice` | POST | Login (form-urlencoded body: `username`, `password`, `redirect=false`) |
| `/bonita/logoutservice` | GET | Terminate session |
| `/API/system/session/unusedId` | GET | Probe current session — returns user info if logged in |

```ts
// Session probe response shape
interface BonitaSession {
  user_id: string;
  user_name: string;
  session_id: string;
  is_technical_user: boolean;
  conf: string[];
  token: string;        // CSRF token (mirrors X-Bonita-API-Token cookie)
}
```

## Identity

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/API/identity/user/{id}` | GET | User details (firstName, lastName, etc.) |
| `/API/identity/user?p=0&c=20&f=enabled=true` | GET | Paged user list |
| `/API/identity/professionalContactData/{userId}` | GET | Email, phone |
| `/API/identity/membership?f=user_id={id}` | GET | Group/role memberships |

## BPM — tasks and processes

### Human tasks (assigned to current user)

```
GET /API/bpm/humanTask
  ?p=0&c=20
  &f=state=ready
  &f=user_id={userId}
  &o=priority DESC&o=dueDate ASC
```

Common filters:
- `state=ready` — pending tasks
- `state=executing` — in-progress tasks
- `state=completed` — done tasks
- `assigned_id={userId}` — assigned to a specific user

### Task actions

| Endpoint | Method | Body |
|----------|--------|------|
| `/API/bpm/userTask/{taskId}/execution` | POST | Variables JSON `{}` |
| `/API/bpm/humanTask/{taskId}` | PUT | `{ "assigned_id": "{userId}" }` to claim/release |

### Process instances

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/API/bpm/process` | GET | Available processes (definitions) |
| `/API/bpm/process/{id}/instantiation` | POST | Start a new process instance |
| `/API/bpm/processInstance` | GET | Active instances |
| `/API/bpm/archivedProcessInstance` | GET | Completed instances |
| `/API/bpm/case/{id}` | GET | Case details |

### Process variables

```
GET /API/bpm/caseVariable?f=case_id={id}
GET /API/bpm/activityVariable?f=activity_id={id}
PUT /API/bpm/caseVariable/{caseId}/{variableName}    body: { value, type }
```

## BDM — Business Data Model

Business data is queryable via custom queries declared on each business object:

```
GET /API/bdm/businessData/{fully.qualified.ClassName}
  ?q={queryName}
  &p=0&c=50
  &f=field=value          # query parameters
```

Example — find configuration entries by type:
```
GET /API/bdm/businessData/com.myapp.PBConfiguration
  ?q=findByRefEntityType&f=refEntityType=THEME&p=0&c=50
```

## REST API Extensions

Custom REST endpoints written in Groovy live under `/API/extension/`:

```
GET  /API/extension/{extensionName}/{path}
POST /API/extension/{extensionName}/{path}    body: JSON
```

Use these when the default Bonita APIs aren't sufficient (cross-domain queries, custom aggregations, integration calls).

## Documents

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/API/bpm/caseDocument` | GET | Documents attached to a case |
| `/API/bpm/caseDocument` | POST | Upload (multipart) |
| `/portal/{tenant}/resource/process/{procName}/{procVersion}/document/{docId}` | GET | Download |

## Living Applications (Application descriptors)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/API/living/application` | GET | Available applications |
| `/API/living/application-page` | GET | Pages of an application |

## Pagination & filtering — universal rules

Most list endpoints share the same query params:

| Param | Meaning | Example |
|-------|---------|---------|
| `p` | Page number (0-indexed) | `p=0` |
| `c` | Count per page | `c=20` |
| `o` | Order — `field ASC\|DESC`. **Repeat the param** for multiple criteria — do NOT comma-separate | `o=priority DESC&o=dueDate ASC` |
| `f` | Filter — `field=value`, repeat for multiple | `f=state=ready&f=user_id=123` |
| `s` | Search (free text on indexed fields) | `s=invoice` |
| `d` | Deploy — embed related entities | `d=processDefinitionId` |

> **Bonita 2025.x parses `o` strictly**: `o=priority DESC,dueDate ASC` (comma-separated) returns HTTP 500. Use `URLSearchParams.append('o', ...)` once per criterion, or repeat `&o=...` manually if building the string by hand. Older Bonita versions tolerated commas; the new parser does not.

Response: a JSON array. The total count comes in the `Content-Range` header (`0-19/4321`).

```ts
// Read total count for pagination
const range = response.headers.get('Content-Range');
const total = range ? Number(range.split('/')[1]) : 0;
```

## Error responses

| Status | Meaning | What to do |
|--------|---------|------------|
| 401 | No session / expired | Redirect to login (or show login modal) |
| 403 | Authenticated but lacks permission, or CSRF token missing/invalid | Check token on writes; check user role |
| 404 | Resource not found | Show "not found" UI |
| 400 | Bad query params | Inspect response body for the validation message |
| 500 | Server error | Log the response body and present a generic error |

## Useful tip — the API explorer

Bonita ships an interactive API explorer at:
```
http://localhost:8080/bonita/apidocs/
```

It lists every endpoint with parameters, response shape, and a "try it" form. Use it to discover the exact filter syntax for a domain object.
