import { createMiddleware } from 'hono/factory'
import { auth } from './auth'

export type AuthEnvironment = {
  Variables: {
    session: typeof auth.$Infer.Session | null
  }
}

export const sessionMiddleware = createMiddleware<AuthEnvironment>(
  async (c, next) => {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    })

    c.set('session', session)
    await next()
  },
)
