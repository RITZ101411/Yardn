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

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const apps = pgTable(
  'apps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'restrict' }),
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

export type App = typeof apps.$inferSelect
export type NewApp = typeof apps.$inferInsert
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
