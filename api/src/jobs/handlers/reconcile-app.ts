import { eq } from 'drizzle-orm'
import { getDatabase } from '../../db/client'
import { apps as appsTable, type App } from '../../db/schema'
import { requestController } from '../../services/controller'

type ControllerAppResponse = { name: string; status: string; url: string }

export async function reconcileApp(app: App): Promise<void> {
  if (app.desiredState !== 'deployed') {
    return
  }

  const result = await requestController<ControllerAppResponse>(
    'POST',
    '/apps',
    { name: app.name, image: app.image, port: app.port },
  )

  await getDatabase()
    .update(appsTable)
    .set({
      observedState: 'provisioned',
      url: result.url,
      updatedAt: new Date(),
    })
    .where(eq(appsTable.id, app.id))
}
