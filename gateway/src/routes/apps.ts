import { Hono } from 'hono'

const CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://localhost:3000'

export const apps = new Hono()

apps.post('/apps', async (c) => {
  const body = await c.req.text()

  let res: Response
  try {
    res = await fetch(`${CONTROLLER_URL}/apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  } catch (e) {
    return c.json({ error: 'controller unreachable' }, 502)
  }

  const text = await res.text()
  return c.body(text, res.status as any, {
    'Content-Type': res.headers.get('Content-Type') || 'application/json',
  })
})
