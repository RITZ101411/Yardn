import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { asc, eq } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import { projects as projectsTable } from '../db/schema'

export const projects = new OpenAPIHono()

const ProjectIdParams = z.object({
  projectId: z.string().uuid(),
})

const ProjectRequest = z.object({
  name: z.string().trim().min(1).max(100).openapi({ example: 'My Project' }),
}).openapi('ProjectRequest')

const ProjectResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('ProjectResponse')

const ProjectErrorResponse = z.object({
  error: z.string(),
}).openapi('ProjectErrorResponse')

const DeleteProjectResponse = z.object({
  id: z.string().uuid(),
  status: z.literal('deleted'),
}).openapi('DeleteProjectResponse')

function serializeProject(project: typeof projectsTable.$inferSelect) {
  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }
}

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
      content: {
        'application/json': {
          schema: z.object({ projects: z.array(ProjectResponse) }),
        },
      },
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
  },
})

projects.openapi(createProjectRoute, async (c) => {
  const input = c.req.valid('json')
  const [project] = await getDatabase()
    .insert(projectsTable)
    .values(input)
    .returning()

  return c.json(serializeProject(project), 201)
})

projects.openapi(listProjectsRoute, async (c) => {
  const rows = await getDatabase()
    .select()
    .from(projectsTable)
    .orderBy(asc(projectsTable.createdAt))

  return c.json({ projects: rows.map(serializeProject) }, 200)
})

projects.openapi(getProjectRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const [project] = await getDatabase()
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1)

  if (!project) return c.json({ error: 'project not found' }, 404)

  return c.json(serializeProject(project), 200)
})

projects.openapi(updateProjectRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const input = c.req.valid('json')
  const [project] = await getDatabase()
    .update(projectsTable)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId))
    .returning()

  if (!project) return c.json({ error: 'project not found' }, 404)

  return c.json(serializeProject(project), 200)
})

projects.openapi(deleteProjectRoute, async (c) => {
  const { projectId } = c.req.valid('param')
  const [project] = await getDatabase()
    .delete(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .returning({ id: projectsTable.id })

  if (!project) return c.json({ error: 'project not found' }, 404)

  return c.json({ id: project.id, status: 'deleted' as const }, 200)
})
