import { z } from '@hono/zod-openapi'
import type { App } from '../db/schema'

export const AppName = z.string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)

const Port = z.number().int().min(1).max(65535)

export const ProjectParams = z.object({
  projectId: z.string().uuid(),
})

export const ProjectAppParams = z.object({
  projectId: z.string().uuid(),
  name: AppName,
})

export const CreateAppRequest = z.object({
  name: AppName.openapi({ example: 'myapp' }),
  image: z.string().trim().min(1).openapi({ example: 'nginx:latest' }),
  port: Port.default(80).openapi({ example: 80 }),
}).openapi('CreateAppRequest')

export const UpdateAppRequest = z.object({
  image: z.string().trim().min(1).openapi({ example: 'nginx:1.27' }),
  port: Port.default(80).openapi({ example: 80 }),
}).openapi('UpdateAppRequest')

export const AppResponse = z.object({
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

export const AppsResponse = z.object({
  apps: z.array(AppResponse),
}).openapi('AppsResponse')

export const AppErrorResponse = z.object({
  error: z.string(),
  appId: z.string().uuid().optional(),
}).openapi('AppErrorResponse')

export function serializeApp(app: App) {
  return {
    ...app,
    createdAt: app.createdAt.toISOString(),
    updatedAt: app.updatedAt.toISOString(),
  }
}
