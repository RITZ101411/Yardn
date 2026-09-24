import { serve } from '@hono/node-server'
import { app } from './app'
import { deploymentsQueue } from './jobs/deployments'

const port = Number(process.env.PORT) || 8080

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
})

async function shutdown() {
  server.close()
  await deploymentsQueue.close()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
