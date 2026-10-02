// Thin API client. Same-origin fetches (Vite proxy in dev, FastAPI static in prod);
// session identity rides in an HttpOnly cookie the JS never sees.

const HEADERS = { 'Content-Type': 'application/json', 'X-CybrSync-Request': '1' }

function detailText(detail) {
  if (!detail) return null
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ')
  return JSON.stringify(detail)
}

async function request(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: HEADERS,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(detailText(data.detail) || `${res.status} ${res.statusText}`)
    err.status = res.status
    throw err
  }
  return data
}

// Streams Server-Sent Events from a POST endpoint, invoking onEvent per event.
async function streamEvents(path, body, onEvent) {
  const res = await fetch(path, { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify(body) })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(detailText(data.detail) || `${res.status} ${res.statusText}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const line = chunk.split('\n').find((l) => l.startsWith('data: '))
      if (line) onEvent(JSON.parse(line.slice(6)))
    }
  }
}

export function workspaceApi(mode) {
  const base = `/api/${mode}`
  return {
    mode,
    scan: (body) => request('POST', `${base}/scan`, body),
    onboard: (body) => request('POST', `${base}/onboard`, body),
    simulate: (body, onEvent) => streamEvents(`${base}/simulate`, body, onEvent),
    reset: () => request('POST', `${base}/reset`),
  }
}

export const liveSession = {
  status: () => request('GET', '/api/live/session'),
  logon: (body) => request('POST', '/api/live/session', body),
  logoff: () => request('DELETE', '/api/live/session'),
}
