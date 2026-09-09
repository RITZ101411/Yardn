import { Hono } from 'hono'
import type { Context } from 'hono'

const CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://localhost:3000'

export const apps = new Hono()

// controller へ透過転送する共通処理
async function forward(c: Context, method: string, path: string) {
  const body = await c.req.text()

  let res: Response
  try {
    res = await fetch(`${CONTROLLER_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body || undefined,
    })
  } catch {
    return c.json({ error: 'controller unreachable' }, 502)
  }

  const text = await res.text()
  return c.body(text, res.status as any, {
    'Content-Type': res.headers.get('Content-Type') || 'application/json',
  })
}

// アプリ作成
apps.post('/apps', (c) => forward(c, 'POST', '/apps'))

// アプリ更新
apps.put('/apps/:name', (c) => forward(c, 'PUT', `/apps/${c.req.param('name')}`))
