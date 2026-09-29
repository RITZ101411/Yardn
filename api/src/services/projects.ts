import { asc, eq } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import {
  apps as appsTable,
  projects as projectsTable,
} from '../db/schema'

type ProjectInput = {
  name: string
}

export class ProjectNotFoundError extends Error {}
export class ProjectHasAppsError extends Error {}

function isForeignKeyViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if ('code' in error && error.code === '23503') return true
  return 'cause' in error && isForeignKeyViolation(error.cause)
}

export async function createProject(input: ProjectInput) {
  const [project] = await getDatabase()
    .insert(projectsTable)
    .values(input)
    .returning()

  return project
}

export function listProjects() {
  return getDatabase()
    .select()
    .from(projectsTable)
    .orderBy(asc(projectsTable.createdAt))
}

export async function getProject(projectId: string) {
  const [project] = await getDatabase()
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1)

  if (!project) throw new ProjectNotFoundError()
  return project
}

export async function updateProject(projectId: string, input: ProjectInput) {
  const [project] = await getDatabase()
    .update(projectsTable)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projectsTable.id, projectId))
    .returning()

  if (!project) throw new ProjectNotFoundError()
  return project
}

export async function deleteProject(projectId: string) {
  const [app] = await getDatabase()
    .select({ id: appsTable.id })
    .from(appsTable)
    .where(eq(appsTable.projectId, projectId))
    .limit(1)

  if (app) throw new ProjectHasAppsError()

  try {
    const [project] = await getDatabase()
      .delete(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .returning({ id: projectsTable.id })

    if (!project) throw new ProjectNotFoundError()
    return project
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw new ProjectHasAppsError()
    }
    throw error
  }
}
