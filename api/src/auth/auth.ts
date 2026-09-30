import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import * as authSchema from '../db/auth-schema'
import { getDatabase } from '../db/client'

const developmentSecret = 'yardn-local-development-secret-change-me'

function getSecret() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV !== 'production') return developmentSecret
  throw new Error('BETTER_AUTH_SECRET is required')
}

function getBaseURL() {
  const baseURL = process.env.BETTER_AUTH_URL
  if (baseURL) return baseURL
  throw new Error('BETTER_AUTH_URL is required')
}

function getTrustedOrigins(baseURL: string) {
  return (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? baseURL)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

const baseURL = getBaseURL()

export const auth = betterAuth({
  database: drizzleAdapter(getDatabase(), {
    provider: 'pg',
    schema: authSchema,
    usePlural: true,
  }),
  basePath: '/auth',
  baseURL,
  secret: getSecret(),
  trustedOrigins: getTrustedOrigins(baseURL),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.AUTH_SIGN_UP_ENABLED !== 'true',
  },
})
