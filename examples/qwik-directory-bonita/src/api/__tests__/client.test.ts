import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';

// Replace this import with the project's actual API client surface.
// The test demonstrates wiring MSW + Vitest; project tests assert against
// the real client behavior (CSRF header, 401 handler, error mapping, etc.).
describe('Bonita API client (smoke)', () => {
  it('hits the mocked session endpoint', async () => {
    server.use(
      http.get('/bonita/API/system/session/unusedId', () =>
        HttpResponse.json({ user_name: 'test.user' })
      )
    );
    const res = await fetch('/bonita/API/system/session/unusedId', {
      credentials: 'include',
    });
    const json = (await res.json()) as { user_name: string };
    expect(json.user_name).toBe('test.user');
  });
});
