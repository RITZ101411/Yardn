import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { auth } from './auth/auth'
import { health } from './routes/health'
import { apps } from './routes/apps'
import { projects } from './routes/projects'

export const app = new OpenAPIHono()

app.all('/auth/*', (c) => auth.handler(c.req.raw))
app.route('/', health)
app.route('/', apps)
app.route('/', projects)

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'internal server error' }, 500)
})

app.doc('/doc', {
  openapi: '3.1.0',
  info: {
    title: 'Deploy API',
    version: '0.1.0',
    description: 'PaaS API for managing projects and apps',
  },
})

app.get('/reference', Scalar({ url: '/doc' }))
