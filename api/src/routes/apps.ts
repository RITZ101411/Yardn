import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { and, asc, eq } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import {
  apps as appsTable,
  projects as projectsTable,
} from '../db/schema'
import { ControllerError, requestController } from '../services/controller'

export const apps = new OpenAPIHono()

const AppName = z.string().min(1).max(63).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
const Port = z.number().int().min(1).max(65535)
const ProjectParams = z.object({ projectId: z.string().uuid() })
const ProjectAppParams = z.object({
  projectId: z.string().uuid(),
  name: AppName,
})

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
  projectId: z.string().uuid(),
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

async function projectExists(projectId: string) {
  const [project] = await getDatabase()
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1)

  return Boolean(project)
}

async function findApp(projectId: string, name: string) {
  const [app] = await getDatabase()
    .select()
    .from(appsTable)
    .where(
      and(
        eq(appsTable.projectId, projectId),
        eq(appsTable.name, name),
      ),
    )
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
  method: 'post',
  path: '/projects/{projectId}/apps',
  tags: ['Apps'],
  summary: 'Create an app in a project',
  request: {
    params: ProjectParams,
    body: {
      content: {
        'application/json': { schema: CreateAppRequest },
      },
    },
  },
  responses: {
    201: {
      description: 'App created',
      content: { 'application/json': { schema: AppResponse } },
    },
    404: {
      description: 'Project not found',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    409: {
      description: 'App name already exists',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    502: {
      description: 'Controller error',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

const listAppsRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/apps',
  tags: ['Apps'],
  summary: 'List apps in a project',
  request: { params: ProjectParams },
  responses: {
    200: {
      description: 'Apps',
      content: {
        'application/json': {
          schema: z.object({ apps: z.array(AppResponse) }),
        },
      },
    },
    404: {
      description: 'Project not found',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

const getAppRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/apps/{name}',
  tags: ['Apps'],
  summary: 'Get an app in a project',
  request: { params: ProjectAppParams },
  responses: {
    200: {
      description: 'App',
      content: { 'application/json': { schema: AppResponse } },
    },
    404: {
      description: 'App not found',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

const updateAppRoute = createRoute({
  method: 'put',
  path: '/projects/{projectId}/apps/{name}',
  tags: ['Apps'],
  summary: 'Update an app in a project',
  request: {
    params: ProjectAppParams,
    body: {
      content: {
        'application/json': { schema: UpdateAppRequest },
      },
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
      description: 'Controller error',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

const deleteAppRoute = createRoute({
  method: 'delete',
  path: '/projects/{projectId}/apps/{name}',
  tags: ['Apps'],
  summary: 'Delete an app from a project',
  request: { params: ProjectAppParams },
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
      description: 'Controller error',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

apps.openapi(createAppRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const input = c.req.valid('json')
  let app: typeof appsTable.$inferSelect

  if (!(await projectExists(projectId))) {
    return c.json({ error: 'project not found' }, 404)
  }

  try {
    const [created] = await getDatabase()
      .insert(appsTable)
      .values({ ...input, projectId })
      .returning()
    app = created
  } catch (error) {
    if (isUniqueViolation(error)) {
      return c.json({ error: `app '${input.name}' already exists` }, 409)
    }
    throw error
  }

  try {
    await enqueueReconcileApp(app.id)
    return c.json(serializeApp(app), 202)
  } catch {
    await markFailed(app.id)
    return c.json({ error: 'job queue unavailable', appId: app.id }, 503)
  }
})

apps.openapi(listAppsRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  if (!(await projectExists(projectId))) {
    return c.json({ error: 'project not found' }, 404)
  }

  const rows = await getDatabase()
    .select()
    .from(appsTable)
    .where(eq(appsTable.projectId, projectId))
    .orderBy(asc(appsTable.createdAt))
  return c.json({ apps: rows.map(serializeApp) }, 200)
})

apps.openapi(getAppRoute, async (c) => {
  const { projectId, name } = c.req.valid('param')
  const app = await findApp(projectId, name)
  if (!app) return c.json({ error: 'app not found' }, 404)
  return c.json(serializeApp(app), 200)
})

apps.openapi(updateAppRoute, async (c) => {
  const { projectId, name } = c.req.valid('param')
  const input = c.req.valid('json')
  const app = await findApp(projectId, name)
  if (!app) return c.json({ error: `app '${name}' not found` }, 404)

  const [updated] = await getDatabase()
    .update(appsTable)
    .set({
      image: input.image,
      port: input.port,
      observedState: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(appsTable.id, app.id))
    .returning()

  try {
    const result = await requestController<ControllerAppResponse>(
      'PUT',
      `/apps/${encodeURIComponent(name)}`,
      input,
    )
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
    return c.json({ error: 'job queue unavailable', appId: app.id }, 503)
  }
})

apps.openapi(deleteAppRoute, async (c) => {
  const { projectId, name } = c.req.valid('param')
  const app = await findApp(projectId, name)
  if (!app) return c.json({ error: `app '${name}' not found` }, 404)

  const [updated] = await getDatabase()
    .update(appsTable)
    .set({
      desiredState: 'deleted',
      observedState: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(appsTable.id, app.id))
    .returning()

  try {
    await enqueueDeleteApp(app.id)
    return c.json(serializeApp(updated), 202)
  } catch {
    await markFailed(app.id)
    return c.json({ error: 'job queue unavailable', appId: app.id }, 503)
  }
})
