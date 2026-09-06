import { Hono } from 'hono'
import { health } from './routes/health'
import { apps } from './routes/apps'

export const app = new Hono()

app.route('/', health)

app.route('/', apps)
