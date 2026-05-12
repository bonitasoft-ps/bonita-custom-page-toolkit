import { http, HttpResponse } from 'msw';

// Bonita REST mocks — tests that hit /bonita/API/... use these without
// requiring a real server. Override per-test with server.use(...).
export const handlers = [
  http.get('/bonita/API/system/session/unusedId', () =>
    HttpResponse.json({
      user_id: '4',
      user_name: 'test.user',
      session_id: 'mock-session',
      conf: 'production',
    })
  ),
  http.get('/bonita/API/bpm/humanTask', () =>
    HttpResponse.json([], { headers: { 'Content-Range': '0-0/0' } })
  ),
  http.post('/bonita/API/bpm/userTask/:taskId/execution', () =>
    HttpResponse.json({}, { status: 204 })
  ),
  http.get('/bonita/API/bpm/process', () =>
    HttpResponse.json([], { headers: { 'Content-Range': '0-0/0' } })
  ),
  http.get('/bonita/API/bpm/case', () =>
    HttpResponse.json([], { headers: { 'Content-Range': '0-0/0' } })
  ),
];
