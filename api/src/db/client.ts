import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from '../../node_modules/@types/pg'
import * as schema from './schema'

export type Database = NodePgDatabase<typeof schema>

let pool: Pool | undefined
let database: Database | undefined

export function getDatabase(): Database {
  if (database) {
    return database
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  pool = new Pool({ connectionString })
  database = drizzle(pool, { schema })
  return database
}

export async function closeDatabase(): Promise<void> {
  await pool?.end()
  pool = undefined
  database = undefined
}
