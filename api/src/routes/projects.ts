import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import {
  DeleteProjectResponse,
  ProjectErrorResponse,
  ProjectIdParams,
  ProjectRequest,
  ProjectResponse,
  ProjectsResponse,
  serializeProject,
} from '../schemas/projects'
import {
  ProjectHasAppsError,
  ProjectNotFoundError,
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from '../services/projects'

export const projects = new OpenAPIHono()

const createProjectRoute = createRoute({
  method: 'post',
  path: '/projects',
  tags: ['Projects'],
  summary: 'Create a project',
  request: {
    body: {
      content: {
        'application/json': { schema: ProjectRequest },
      },
    },
  },
  responses: {
    201: {
      description: 'Project created',
      content: { 'application/json': { schema: ProjectResponse } },
    },
  },
})

const listProjectsRoute = createRoute({
  method: 'get',
  path: '/projects',
  tags: ['Projects'],
  summary: 'List projects',
  responses: {
    200: {
      description: 'Projects',
      content: { 'application/json': { schema: ProjectsResponse } },
    },
  },
})

const getProjectRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}',
  tags: ['Projects'],
  summary: 'Get a project',
  request: { params: ProjectIdParams },
  responses: {
    200: {
      description: 'Project',
      content: { 'application/json': { schema: ProjectResponse } },
    },
    404: {
      description: 'Project not found',
      content: { 'application/json': { schema: ProjectErrorResponse } },
    },
  },
})

const updateProjectRoute = createRoute({
  method: 'put',
  path: '/projects/{projectId}',
  tags: ['Projects'],
  summary: 'Update a project',
  request: {
    params: ProjectIdParams,
    body: {
      content: {
        'application/json': { schema: ProjectRequest },
      },
    },
  },
  responses: {
    200: {
      description: 'Project updated',
      content: { 'application/json': { schema: ProjectResponse } },
    },
    404: {
      description: 'Project not found',
      content: { 'application/json': { schema: ProjectErrorResponse } },
    },
  },
})

const deleteProjectRoute = createRoute({
  method: 'delete',
  path: '/projects/{projectId}',
  tags: ['Projects'],
  summary: 'Delete a project',
  request: { params: ProjectIdParams },
  responses: {
    200: {
      description: 'Project deleted',
      content: { 'application/json': { schema: DeleteProjectResponse } },
    },
    404: {
      description: 'Project not found',
      content: { 'application/json': { schema: ProjectErrorResponse } },
    },
    409: {
      description: 'Project still contains apps',
      content: { 'application/json': { schema: ProjectErrorResponse } },
    },
  },
})

projects.openapi(createProjectRoute, async (c) => {
  const project = await createProject(c.req.valid('json'))
  return c.json(serializeProject(project), 201)
})

projects.openapi(listProjectsRoute, async (c) => {
  const rows = await listProjects()
  return c.json({ projects: rows.map(serializeProject) }, 200)
})

projects.openapi(getProjectRoute, async (c) => {
  const { projectId } = c.req.valid('param')

  try {
    const project = await getProject(projectId)
    return c.json(serializeProject(project), 200)
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return c.json({ error: 'project not found' }, 404)
    }
    throw error
  }
})

projects.openapi(updateProjectRoute, async (c) => {
  const { projectId } = c.req.valid('param')

  try {
    const project = await updateProject(projectId, c.req.valid('json'))
    return c.json(serializeProject(project), 200)
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return c.json({ error: 'project not found' }, 404)
    }
    throw error
  }
})

projects.openapi(deleteProjectRoute, async (c) => {
  const { projectId } = c.req.valid('param')

  try {
    const project = await deleteProject(projectId)
    return c.json({ id: project.id, status: 'deleted' as const }, 200)
  } catch (error) {
    if (error instanceof ProjectNotFoundError) {
      return c.json({ error: 'project not found' }, 404)
    }
    if (error instanceof ProjectHasAppsError) {
      return c.json({ error: 'project still contains apps' }, 409)
    }
    throw error
  }
})
