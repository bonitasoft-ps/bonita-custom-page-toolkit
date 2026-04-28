# Authentication & CSRF — framework-agnostic patterns

Bonita's auth model uses two cookies, set by Bonita itself at login:

| Cookie | Purpose | Sent automatically? |
|--------|---------|---------------------|
| `JSESSIONID` | Tomcat session | Yes (with `credentials: 'include'`) |
| `X-Bonita-API-Token` | CSRF token | Yes — but you must ALSO echo it as a request header |
| `BOS_Locale` | User's locale | Yes (informational) |

The CSRF protection works by requiring every mutating request (POST/PUT/DELETE) to include a header `X-Bonita-API-Token` whose value matches the cookie. An attacker on a different origin can't read the cookie, so they can't forge the header — that's the protection.

## Reading the CSRF cookie

The cookie value must be URL-decoded:

```ts
function getCsrfTokenFromCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)X-Bonita-API-Token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
```

This works in any framework — it's plain DOM. React puts it in `src/api/client.ts`, Vue in `src/api/client.ts`, Angular in an HTTP interceptor.

## Login flow

```
1. POST /bonita/loginservice
   Content-Type: application/x-www-form-urlencoded
   Body: username=...&password=...&redirect=false
   credentials: include

2. Bonita responds 200 OK and Set-Cookie: JSESSIONID, X-Bonita-API-Token, BOS_Locale

3. Subsequent calls now have the cookies and can read X-Bonita-API-Token
```

**Critical**: `redirect=false` prevents Bonita from issuing a 302 redirect to its portal. Without it, the SPA's fetch follows the redirect and ends up parsing HTML instead of the expected response.

## Session probe (re-entering an authenticated session)

When the SPA loads inside the Bonita Portal iframe, the user is **already logged in**. Probe the session before showing a login form:

```ts
async function getSession(): Promise<BonitaSession | null> {
  const res = await fetch('/bonita/API/system/session/unusedId', {
    credentials: 'include',
  });
  if (!res.ok) return null;
  return res.json();
}
```

The `/unusedId` suffix is just a placeholder Bonita requires for the path — the API ignores it.

## Logout

```ts
await fetch('/bonita/logoutservice', {
  method: 'GET',
  credentials: 'include',
});
```

After logout:
- Clear all client-side state (user, token, cached data)
- Redirect to your login page (or refresh the iframe — Bonita Portal will redirect to its own login)

## Centralized HTTP wrapper — the pattern

Every framework needs a single function that:

1. Prepends `/bonita/API`
2. Reads the CSRF token from the cookie
3. Sets it as the `X-Bonita-API-Token` header
4. Sends `credentials: 'include'`
5. Detects 401/403 and triggers a session-expired callback
6. Parses JSON, handles 204 No Content, handles empty bodies

Pseudocode:

```ts
async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getCsrfTokenFromCookie();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('X-Bonita-API-Token', token);

  const res = await fetch(`/bonita/API${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 || res.status === 403) {
    onSessionExpired();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}
```

Concrete framework-specific implementations:
- **React**: `src/api/client.ts` (function module)
- **Vue**: `src/api/client.ts` (composition function or plain module)
- **Angular**: `HttpInterceptor` reading the cookie + `withCredentials: true`

## Why the token is in a cookie AND a header

This is the standard "double-submit cookie" CSRF defence:

- An attacker site on `evil.com` cannot read cookies on `bonita.example.com` (Same-Origin Policy on cookies).
- An attacker can trigger a POST to `bonita.example.com/API/...` from `evil.com` (browsers send cookies on cross-origin POSTs unless `SameSite=Strict`).
- BUT the attacker cannot set the custom `X-Bonita-API-Token` header to match the cookie, because they can't read it.
- Bonita rejects the request → CSRF blocked.

Your SPA, running on the Bonita origin, CAN read the cookie and set the header. That's the whole point.

## Pitfalls

| Symptom | Cause |
|---------|-------|
| 403 on every POST/PUT/DELETE | Header missing or doesn't match cookie. Did you read with `decodeURIComponent`? |
| 401 on every request | `credentials: 'include'` missing. Check both fetch options and Angular `withCredentials`. |
| Session lost on hard refresh in dev | Vite proxy missing `cookieDomainRewrite: 'localhost'` or the equivalent. |
| Login returns HTML instead of 200 | `redirect=false` form field missing — Bonita issued a 302 to portal. |
| Works in dev, fails in prod | Hard-coded `http://localhost:8080` somewhere. Use the relative `/bonita` base. |
| 401 on session probe at startup | App is running outside the iframe (dev mode). Show the login page. |
