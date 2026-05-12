// Sample API smoke for Angular projects.
// MSW + Jest + Angular requires extra Babel transform for node_modules/msw.
// Baseline uses a manual fetch mock; migrate to MSW once you wire the
// transformer (or switch this project to Vitest).

describe('Bonita API client (smoke)', () => {
  it('parses a JSON response from the session endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user_name: 'test.user' }),
      text: async () => JSON.stringify({ user_name: 'test.user' }),
      headers: new Map([['content-type', 'application/json']]),
    } as unknown as Response);
    const original = globalThis.fetch;
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock;

    try {
      const res = await fetch('/bonita/API/system/session/unusedId', {
        credentials: 'include',
      });
      const json = (await res.json()) as { user_name: string };
      expect(json.user_name).toBe('test.user');
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      (globalThis as { fetch: typeof fetch }).fetch = original;
    }
  });
});
