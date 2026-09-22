import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const appDesiredState = pgEnum('app_desired_state', [
  'deployed',
  'deleted',
])

export const appObservedState = pgEnum('app_observed_state', [
  'pending',
  'provisioned',
  'available',
  'failed',
  'unknown',
])

export const jobType = pgEnum('job_type', ['deploy', 'update', 'delete'])

export const jobStatus = pgEnum('job_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
])

export const apps = pgTable(
  'apps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 63 }).notNull(),
    image: text('image').notNull(),
    port: integer('port').notNull().default(80),
    url: text('url'),
    desiredState: appDesiredState('desired_state').notNull().default('deployed'),
    observedState: appObservedState('observed_state')
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('apps_name_unique').on(table.name)],
)

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  appId: uuid('app_id')
    .notNull()
    .references(() => apps.id, { onDelete: 'cascade' }),
  type: jobType('type').notNull(),
  status: jobStatus('status').notNull().default('queued'),
  attempt: integer('attempt').notNull().default(0),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export type App = typeof apps.$inferSelect
export type NewApp = typeof apps.$inferInsert
export type Job = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert
