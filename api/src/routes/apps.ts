import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import {
  AppErrorResponse,
  AppResponse,
  AppsResponse,
  CreateAppRequest,
  ProjectAppParams,
  ProjectParams,
  UpdateAppRequest,
  serializeApp,
} from '../schemas/apps'
import {
  AppNameConflictError,
  AppNotFoundError,
  JobQueueUnavailableError,
  ProjectNotFoundError,
  createApp,
  deleteApp,
  getApp,
  listApps,
  updateApp,
} from '../services/apps'

export const apps = new OpenAPIHono()

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
    202: {
      description: 'App accepted for deployment',
      content: { 'application/json': { schema: AppResponse } },
    },
    404: {
      description: 'Project not found',
      content: { 'application/json': { schema: AppErrorResponse } },
    },
    409: {
      description: 'App name already exists',
      content: { 'application/json': { schema: AppErrorResponse } },
    },
    503: {
      description: 'Job queue unavailable',
      content: { 'application/json': { schema: AppErrorResponse } },
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
      content: { 'application/json': { schema: AppsResponse } },
    },
    404: {
      description: 'Project not found',
      content: { 'application/json': { schema: AppErrorResponse } },
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
      content: { 'application/json': { schema: AppErrorResponse } },
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
    202: {
      description: 'App update accepted',
      content: { 'application/json': { schema: AppResponse } },
    },
    404: {
      description: 'App not found',
      content: { 'application/json': { schema: AppErrorResponse } },
    },
    503: {
      description: 'Job queue unavailable',
      content: { 'application/json': { schema: AppErrorResponse } },
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
    202: {
      description: 'App deletion accepted',
      content: { 'application/json': { schema: AppResponse } },
    },
    404: {
      description: 'App not found',
      content: { 'application/json': { schema: AppErrorResponse } },
    },
    503: {
      description: 'Job queue unavailable',
      content: { 'application/json': { schema: AppErrorResponse } },
    },
  },
})

apps.openapi(createAppRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const input = c.req.valid('json')

  try {
    const app = await createApp(projectId, input)
    return c.json(serializeApp(app), 202)
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return c.json({ error: 'project not found' }, 404)
    }
    if (error instanceof AppNameConflictError) {
      return c.json({ error: `app '${input.name}' already exists` }, 409)
    }
    if (error instanceof JobQueueUnavailableError) {
      return c.json({ error: error.message, appId: error.appId }, 503)
    }
    throw error
  }
})

apps.openapi(listAppsRoute, async (c) => {
  const { projectId } = c.req.valid('param')

  try {
    const rows = await listApps(projectId)
    return c.json({ apps: rows.map(serializeApp) }, 200)
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return c.json({ error: 'project not found' }, 404)
    }
    throw error
  }
})

apps.openapi(getAppRoute, async (c) => {
  const { projectId, name } = c.req.valid('param')

  try {
    const app = await getApp(projectId, name)
    return c.json(serializeApp(app), 200)
  } catch (error) {
    if (error instanceof AppNotFoundError) {
      return c.json({ error: 'app not found' }, 404)
    }
    throw error
  }
})

apps.openapi(updateAppRoute, async (c) => {
  const { projectId, name } = c.req.valid('param')
  const input = c.req.valid('json')

  try {
    const app = await updateApp(projectId, name, input)
    return c.json(serializeApp(app), 202)
  } catch (error) {
    if (error instanceof AppNotFoundError) {
      return c.json({ error: `app '${name}' not found` }, 404)
    }
    if (error instanceof JobQueueUnavailableError) {
      return c.json({ error: error.message, appId: error.appId }, 503)
    }
    throw error
  }
})

apps.openapi(deleteAppRoute, async (c) => {
  const { projectId, name } = c.req.valid('param')

  try {
    const app = await deleteApp(projectId, name)
    return c.json(serializeApp(app), 202)
  } catch (error) {
    if (error instanceof AppNotFoundError) {
      return c.json({ error: `app '${name}' not found` }, 404)
    }
    if (error instanceof JobQueueUnavailableError) {
      return c.json({ error: error.message, appId: error.appId }, 503)
    }
    throw error
  }
})
