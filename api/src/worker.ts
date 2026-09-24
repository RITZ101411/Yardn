import { Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import { closeDatabase, getDatabase } from './db/client'
import { apps as appsTable } from './db/schema'
import {
  deploymentsQueueName,
  type DeploymentJobData,
  type DeploymentJobName,
} from './jobs/deployments'
import { redisConnection } from './jobs/connection'
import { deleteApp } from './jobs/handlers/delete-app'
import { reconcileApp } from './jobs/handlers/reconcile-app'

const worker = new Worker<DeploymentJobData, void, DeploymentJobName>(
  deploymentsQueueName,
  async (job) => {
    const [app] = await getDatabase()
      .select()
      .from(appsTable)
      .where(eq(appsTable.id, job.data.appId))
      .limit(1)

    if (!app) {
      return
    }

    await getDatabase()
      .update(appsTable)
      .set({ observedState: 'pending', updatedAt: new Date() })
      .where(eq(appsTable.id, app.id))

    try {
      switch (job.name) {
        case 'reconcile-app':
          await reconcileApp(app)
          break
        case 'delete-app':
          await deleteApp(app)
          break
      }
    } catch (error) {
      await getDatabase()
        .update(appsTable)
        .set({ observedState: 'failed', updatedAt: new Date() })
        .where(eq(appsTable.id, app.id))
      throw error
    }
  },
  {
    connection: { ...redisConnection, maxRetriesPerRequest: null },
    concurrency: 5,
  },
)

worker.on('completed', (job) => {
  console.log(`completed ${job.name} job ${job.id}`)
})

worker.on('failed', (job, error) => {
  console.error(`failed ${job?.name ?? 'unknown'} job ${job?.id ?? 'unknown'}`, error)
})

async function shutdown() {
  await worker.close()
  await closeDatabase()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

console.log('Worker started')
