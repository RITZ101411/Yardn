import { OpenAPIHono } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { health } from './routes/health'
import { apps } from './routes/apps'

export const app = new OpenAPIHono()

app.route('/', health)
app.route('/', apps)

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'internal server error' }, 500)
})

app.doc('/doc', {
  openapi: '3.1.0',
  info: {
    title: 'Deploy Gateway API',
    version: '0.1.0',
    description: 'PaaS gateway API for managing apps',
  },
})

app.get('/reference', Scalar({ url: '/doc' }))
