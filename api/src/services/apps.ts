import { and, asc, eq } from 'drizzle-orm'
import { getDatabase } from '../db/client'
import {
  apps as appsTable,
  projects as projectsTable,
  type App,
} from '../db/schema'
import { enqueueDeleteApp, enqueueReconcileApp } from '../jobs/deployments'

type CreateAppInput = {
  name: string
  image: string
  port: number
}

type UpdateAppInput = {
  image: string
  port: number
}

export class ProjectNotFoundError extends Error {}
export class AppNotFoundError extends Error {}
export class AppNameConflictError extends Error {}

export class JobQueueUnavailableError extends Error {
  constructor(public readonly appId: string) {
    super('job queue unavailable')
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

async function enqueue(
  app: App,
  enqueueJob: (appId: string) => Promise<void>,
) {
  try {
    await enqueueJob(app.id)
  } catch {
    await markFailed(app.id)
    throw new JobQueueUnavailableError(app.id)
  }

  return app
}

export async function createApp(projectId: string, input: CreateAppInput) {
  if (!(await projectExists(projectId))) {
    throw new ProjectNotFoundError()
  }

  let app: App

  try {
    const [created] = await getDatabase()
      .insert(appsTable)
      .values({ ...input, projectId })
      .returning()
    app = created
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppNameConflictError()
    }
    throw error
  }

  return enqueue(app, enqueueReconcileApp)
}

export async function listApps(projectId: string) {
  if (!(await projectExists(projectId))) {
    throw new ProjectNotFoundError()
  }

  return getDatabase()
    .select()
    .from(appsTable)
    .where(eq(appsTable.projectId, projectId))
    .orderBy(asc(appsTable.createdAt))
}

export async function getApp(projectId: string, name: string) {
  const app = await findApp(projectId, name)
  if (!app) throw new AppNotFoundError()
  return app
}

export async function updateApp(
  projectId: string,
  name: string,
  input: UpdateAppInput,
) {
  const app = await findApp(projectId, name)
  if (!app) throw new AppNotFoundError()

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

  return enqueue(updated, enqueueReconcileApp)
}

export async function deleteApp(projectId: string, name: string) {
  const app = await findApp(projectId, name)
  if (!app) throw new AppNotFoundError()

  const [updated] = await getDatabase()
    .update(appsTable)
    .set({
      desiredState: 'deleted',
      observedState: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(appsTable.id, app.id))
    .returning()

  return enqueue(updated, enqueueDeleteApp)
}
