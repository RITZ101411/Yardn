import { z } from '@hono/zod-openapi'
import type { Project } from '../db/schema'

export const ProjectIdParams = z.object({
  projectId: z.string().uuid(),
})

export const ProjectRequest = z.object({
  name: z.string().trim().min(1).max(100).openapi({ example: 'My Project' }),
}).openapi('ProjectRequest')

export const ProjectResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).openapi('ProjectResponse')

export const ProjectsResponse = z.object({
  projects: z.array(ProjectResponse),
}).openapi('ProjectsResponse')

export const ProjectErrorResponse = z.object({
  error: z.string(),
}).openapi('ProjectErrorResponse')

export const DeleteProjectResponse = z.object({
  id: z.string().uuid(),
  status: z.literal('deleted'),
}).openapi('DeleteProjectResponse')

export function serializeProject(project: Project) {
  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }
}
