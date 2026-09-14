import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { asc, eq } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import { apps as appsTable } from '../db/schema'
import { ControllerError, requestController } from '../services/controller'

export const apps = new OpenAPIHono()

const AppName = z.string().min(1).max(63).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
const Port = z.number().int().min(1).max(65535)
const AppNameParams = z.object({ name: AppName })

const CreateAppRequest = z.object({
  name: AppName.openapi({ example: 'myapp' }),
  image: z.string().trim().min(1).openapi({ example: 'nginx:latest' }),
  port: Port.default(80).openapi({ example: 80 }),
}).openapi('CreateAppRequest')

const UpdateAppRequest = z.object({
  image: z.string().trim().min(1).openapi({ example: 'nginx:1.27' }),
  port: Port.default(80).openapi({ example: 80 }),
}).openapi('UpdateAppRequest')

const AppResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  image: z.string(),
  port: z.number().int(),
  desiredState: z.enum(['deployed', 'deleted']),
  observedState: z.enum(['pending', 'provisioned', 'available', 'failed', 'unknown']),
  url: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('AppResponse')

const ErrorResponse = z.object({
  error: z.string(),
  appId: z.string().uuid().optional(),
}).openapi('AppErrorResponse')

const DeleteResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.literal('deleted'),
}).openapi('DeleteAppResponse')

type ControllerAppResponse = { name: string; status: string; url: string }

function serializeApp(app: typeof appsTable.$inferSelect) {
  return {
    ...app,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if ('code' in error && error.code === '23505') return true
  return 'cause' in error && isUniqueViolation(error.cause)
}

async function findApp(name: string) {
  const [app] = await getDatabase()
    .select()
    .from(appsTable)
    .where(eq(appsTable.name, name))
    .limit(1)
  return app
}

async function markFailed(id: string) {
  await getDatabase()
    .update(appsTable)
    .set({ observedState: 'failed', updatedAt: new Date() })
    .where(eq(appsTable.id, id))
}

const createAppRoute = createRoute({
  method: 'post', path: '/apps', tags: ['Apps'], summary: 'Create an app',
  request: { body: { content: { 'application/json': { schema: CreateAppRequest } } } },
  responses: {
    201: { description: 'App created', content: { 'application/json': { schema: AppResponse } } },
    409: { description: 'App name already exists', content: { 'application/json': { schema: ErrorResponse } } },
    502: { description: 'Controller error', content: { 'application/json': { schema: ErrorResponse } } },
  },
})

const listAppsRoute = createRoute({
  method: 'get', path: '/apps', tags: ['Apps'], summary: 'List apps',
  responses: {
    200: { description: 'Apps', content: { 'application/json': { schema: z.object({ apps: z.array(AppResponse) }) } } },
  },
})

const getAppRoute = createRoute({
  method: 'get', path: '/apps/{name}', tags: ['Apps'], summary: 'Get an app',
  request: { params: AppNameParams },
  responses: {
    200: { description: 'App', content: { 'application/json': { schema: AppResponse } } },
    404: { description: 'App not found', content: { 'application/json': { schema: ErrorResponse } } },
  },
})

const updateAppRoute = createRoute({
  method: 'put', path: '/apps/{name}', tags: ['Apps'], summary: 'Update an app',
  request: { params: AppNameParams, body: { content: { 'application/json': { schema: UpdateAppRequest } } } },
  responses: {
    200: { description: 'App updated', content: { 'application/json': { schema: AppResponse } } },
    404: { description: 'App not found', content: { 'application/json': { schema: ErrorResponse } } },
    502: { description: 'Controller error', content: { 'application/json': { schema: ErrorResponse } } },
  },
})

const deleteAppRoute = createRoute({
  method: 'delete', path: '/apps/{name}', tags: ['Apps'], summary: 'Delete an app',
  request: { params: AppNameParams },
  responses: {
    200: { description: 'App deleted', content: { 'application/json': { schema: DeleteResponse } } },
    404: { description: 'App not found', content: { 'application/json': { schema: ErrorResponse } } },
    502: { description: 'Controller error', content: { 'application/json': { schema: ErrorResponse } } },
  },
})

apps.openapi(createAppRoute, async (c) => {
  const input = c.req.valid('json')
  let app: typeof appsTable.$inferSelect

  try {
    const [created] = await getDatabase()
      .insert(appsTable)
      .values(input)
      .returning()
    app = created
  } catch (error) {
    if (isUniqueViolation(error)) return c.json({ error: `app '${input.name}' already exists` }, 409)
    throw error
  }

  try {
    const result = await requestController<ControllerAppResponse>('POST', '/apps', input)
    const [updated] = await getDatabase()
      .update(appsTable)
      .set({
        observedState: 'provisioned',
        url: result.url,
        updatedAt: new Date(),
      })
      .where(eq(appsTable.id, app.id))
      .returning()
    return c.json(serializeApp(updated), 201)
  } catch (error) {
    await markFailed(app.id)
    return c.json({ error: error instanceof Error ? error.message : 'controller error', appId: app.id }, 502)
  }
})

apps.openapi(listAppsRoute, async (c) => {
  const rows = await getDatabase()
    .select()
    .from(appsTable)
    .orderBy(asc(appsTable.createdAt))
  return c.json({ apps: rows.map(serializeApp) }, 200)
})

apps.openapi(getAppRoute, async (c) => {
  const app = await findApp(c.req.valid('param').name)
  if (!app) return c.json({ error: 'app not found' }, 404)
  return c.json(serializeApp(app), 200)
})

apps.openapi(updateAppRoute, async (c) => {
  const name = c.req.valid('param').name
  const input = c.req.valid('json')
  const app = await findApp(name)
  if (!app) return c.json({ error: `app '${name}' not found` }, 404)

  await getDatabase()
    .update(appsTable)
    .set({
      image: input.image,
      port: input.port,
      observedState: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(appsTable.id, app.id))

  try {
    const result = await requestController<ControllerAppResponse>('PUT', `/apps/${encodeURIComponent(name)}`, input)
    const [updated] = await getDatabase()
      .update(appsTable)
      .set({
        observedState: 'provisioned',
        url: result.url,
        updatedAt: new Date(),
      })
      .where(eq(appsTable.id, app.id))
      .returning()
    return c.json(serializeApp(updated), 200)
  } catch (error) {
    await markFailed(app.id)
    const status = error instanceof ControllerError && error.status === 404 ? 404 : 502
    return c.json({ error: error instanceof Error ? error.message : 'controller error', appId: app.id }, status)
  }
})

apps.openapi(deleteAppRoute, async (c) => {
  const name = c.req.valid('param').name
  const app = await findApp(name)
  if (!app) return c.json({ error: `app '${name}' not found` }, 404)

  try {
    await requestController<unknown>('DELETE', `/apps/${encodeURIComponent(name)}`)
  } catch (error) {
    if (!(error instanceof ControllerError && error.status === 404)) {
      await markFailed(app.id)
      return c.json({ error: error instanceof Error ? error.message : 'controller error', appId: app.id }, 502)
    }
  }

  await getDatabase()
    .delete(appsTable)
    .where(eq(appsTable.id, app.id))
  return c.json({ id: app.id, name, status: 'deleted' as const }, 200)
})
