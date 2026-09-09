import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'

export const health = new OpenAPIHono()

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Health check',
  responses: {
    200: {
      description: 'Service is healthy',
      content: {
        'application/json': {
          schema: z.object({ status: z.string() }).openapi('HealthResponse'),
        },
      },
    },
  },
})

health.openapi(healthRoute, (c) => c.json({ status: 'ok' }))
