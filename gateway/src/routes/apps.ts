import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Context } from 'hono'

const CONTROLLER_URL = process.env.CONTROLLER_URL || 'http://localhost:3000'

export const apps = new OpenAPIHono()

// --- Schemas ---
const CreateAppRequest = z
  .object({
    name: z.string().openapi({ example: 'myapp' }),
    image: z.string().openapi({ example: 'nginx:latest' }),
    port: z.number().int().optional().openapi({ example: 80 }),
  })
  .openapi('CreateAppRequest')

const UpdateAppRequest = z
  .object({
    image: z.string().openapi({ example: 'nginx:1.27' }),
    port: z.number().int().optional().openapi({ example: 80 }),
  })
  .openapi('UpdateAppRequest')

const AppResponse = z
  .object({
    name: z.string(),
    status: z.string(),
    url: z.string(),
  })
  .openapi('AppResponse')

const ErrorResponse = z
  .object({ error: z.string() })
  .openapi('ErrorResponse')

const DeleteResponse = z
  .object({ name: z.string(), status: z.string() })
  .openapi('DeleteResponse')

// --- Forward helper (transparent proxy to controller) ---
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

// --- Routes ---
const createRouteDef = createRoute({
  method: 'post',
  path: '/apps',
  tags: ['Apps'],
  summary: 'Create an app',
  request: {
    body: {
      content: { 'application/json': { schema: CreateAppRequest } },
    },
  },
  responses: {
    201: {
      description: 'App created',
      content: { 'application/json': { schema: AppResponse } },
    },
    502: {
      description: 'Controller unreachable',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

const updateRouteDef = createRoute({
  method: 'put',
  path: '/apps/{name}',
  tags: ['Apps'],
  summary: 'Update an app',
  request: {
    params: z.object({ name: z.string() }),
    body: {
      content: { 'application/json': { schema: UpdateAppRequest } },
    },
  },
  responses: {
    200: {
      description: 'App updated',
      content: { 'application/json': { schema: AppResponse } },
    },
    404: {
      description: 'App not found',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    502: {
      description: 'Controller unreachable',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

const deleteRouteDef = createRoute({
  method: 'delete',
  path: '/apps/{name}',
  tags: ['Apps'],
  summary: 'Delete an app',
  request: {
    params: z.object({ name: z.string() }),
  },
  responses: {
    200: {
      description: 'App deleted',
      content: { 'application/json': { schema: DeleteResponse } },
    },
    404: {
      description: 'App not found',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    502: {
      description: 'Controller unreachable',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

apps.openapi(createRouteDef, (c) => forward(c, 'POST', '/apps') as any)
apps.openapi(updateRouteDef, (c) =>
  forward(c, 'PUT', `/apps/${c.req.param('name')}`) as any,
)
apps.openapi(deleteRouteDef, (c) =>
  forward(c, 'DELETE', `/apps/${c.req.param('name')}`) as any,
)
