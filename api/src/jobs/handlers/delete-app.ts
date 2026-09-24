import { eq } from 'drizzle-orm'
import { getDatabase } from '../../db/client'
import { apps as appsTable, type App } from '../../db/schema'
import {
  ControllerError,
  requestController,
} from '../../services/controller'

export async function deleteApp(app: App): Promise<void> {
  try {
    await requestController<unknown>(
      'DELETE',
      `/apps/${encodeURIComponent(app.name)}`,
    )
  } catch (error) {
    if (!(error instanceof ControllerError && error.status === 404)) {
      throw error
    }
  }

  await getDatabase()
    .delete(appsTable)
    .where(eq(appsTable.id, app.id))
}
