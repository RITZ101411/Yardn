import { Queue } from 'bullmq'
import { redisConnection } from './connection'

export const deploymentsQueueName = 'deployments'

export type DeploymentJobName = 'reconcile-app' | 'delete-app'

export type DeploymentJobData = {
  appId: string
}

export const deploymentsQueue = new Queue<
  DeploymentJobData,
  void,
  DeploymentJobName
>(deploymentsQueueName, {
  connection: { ...redisConnection, maxRetriesPerRequest: 1 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1_000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
})

export async function enqueueReconcileApp(appId: string): Promise<void> {
  await deploymentsQueue.add('reconcile-app', { appId })
}

export async function enqueueDeleteApp(appId: string): Promise<void> {
  await deploymentsQueue.add('delete-app', { appId })
}
