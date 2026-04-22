import Hapi from '@hapi/hapi'

import { secureContext } from '@defra/hapi-secure-context'

import { config } from './config.js'

const isProduction = process.env.NODE_ENV === 'production'
import healthPlugin from './plugins/health/index.js'
import authPlugin from './plugins/auth/index.js'
import areasPlugin from './plugins/areas/index.js'
import accountsPlugin from './plugins/accounts/index.js'
import emailValidationPlugin from './plugins/email-validation/index.js'
import projectsPlugin from './plugins/projects/index.js'
import fileUploadPlugin from './plugins/file-upload/index.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'
import { postgres } from './plugins/database/postgres.js'
import { prisma } from './plugins/database/prisma.js'
import { failAction } from './common/helpers/fail-action.js'
import { pulse } from './common/helpers/pulse.js'
import { requestTracing } from './common/helpers/request-tracing.js'
import { setupProxy } from './common/helpers/proxy/setup-proxy.js'
import jwtAuthPlugin from './plugins/jwt/jwt-auth.js'
import schedulerPlugin from './plugins/scheduler/index.js'
import { loadTasks } from './plugins/scheduler/helpers/task-loader.js'
import swaggerPlugin from './plugins/swagger/index.js'
import downloadsPlugin from './plugins/downloads/index.js'
import gatewayGuardPlugin from './plugins/gateway-guard/index.js'
import externalPlugin from './plugins/external/index.js'

function createServerConfig() {
  return {
    host: config.get('host'),
    port: config.get('port'),
    routes: {
      timeout: {
        server: 30000 // 30 seconds
      },
      validate: {
        options: {
          abortEarly: false
        },
        failAction
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    }
  }
}

async function registerCorePlugins(server) {
  // Hapi Plugins:
  // requestLogger  - automatically logs incoming requests
  // requestTracing - trace header logging and propagation
  // pulse          - provides shutdown handlers
  // postgres       - sets up PostgreSQL connection pool and attaches to `server` and `request` objects
  // prisma         - Prisma ORM integration for type-safe database access
  // jwtAuthPlugin  - JWT authentication strategy
  // schedulerPlugin - distributed task scheduler with PostgreSQL locking
  // router         - routes used in the app
  await server.register([
    requestLogger,
    requestTracing,
    secureContext,
    pulse,
    {
      plugin: postgres,
      options: {
        ...config.get('postgres'),
        awsRegion: config.get('awsRegion')
      }
    },
    {
      plugin: prisma,
      options: {
        ...config.get('postgres'),
        awsRegion: config.get('awsRegion')
      }
    },
    {
      plugin: jwtAuthPlugin,
      options: {
        accessSecret: config.get('auth.jwt.accessSecret'),
        issuer: config.get('auth.jwt.issuer'),
        audience: config.get('auth.jwt.audience')
      }
    },
    gatewayGuardPlugin,
    healthPlugin,
    authPlugin,
    areasPlugin,
    accountsPlugin,
    emailValidationPlugin,
    projectsPlugin,
    fileUploadPlugin,
    downloadsPlugin,
    externalPlugin
  ])
}

async function registerScheduler(server) {
  // Register scheduler after other plugins so logger is available
  const tasks = await loadTasks(server.logger)
  await server.register({
    plugin: schedulerPlugin,
    options: { tasks }
  })
}

async function registerSwagger(server) {
  // Register swagger after all routes are registered so all routes are included
  await server.register(swaggerPlugin)
}

/**
 * Returns an array of error strings for any insecure config values that must
 * be overridden before production startup. Exported so it can be unit-tested
 * directly without needing to spin up the full Hapi server.
 *
 * @param {boolean} isProd - Whether the current environment is production.
 * @param {(path: string) => string} getConfigValue - Function to read a config key.
 * @returns {string[]} List of human-readable error descriptions; empty = OK.
 */
export function collectProductionConfigErrors(isProd, getConfigValue) {
  if (!isProd) {
    return []
  }

  const required = [
    {
      path: 'auth.jwt.accessSecret',
      env: 'JWT_ACCESS_SECRET',
      insecureDefault: 'changeme-access-secret-key-for-development'
    },
    {
      path: 'auth.jwt.refreshSecret',
      env: 'JWT_REFRESH_SECRET',
      insecureDefault: 'changeme-refresh-secret-key-for-development'
    },
    { path: 'auth.jwt.issuer', env: 'JWT_ISSUER', insecureDefault: '' },
    { path: 'auth.jwt.audience', env: 'JWT_AUDIENCE', insecureDefault: '' }
  ]

  return required
    .filter(({ path, insecureDefault }) => {
      const val = getConfigValue(path)
      return !val || val === insecureDefault
    })
    .map(
      ({ env }) =>
        `${env} must be set to a non-empty, non-default value in production`
    )
}

async function validateProductionConfig() {
  const errors = collectProductionConfigErrors(isProduction, (path) =>
    config.get(path)
  )
  if (errors.length > 0) {
    throw new Error(
      `Server startup aborted — insecure configuration detected:\n  ${errors.join('\n  ')}`
    )
  }
}

async function createServer() {
  setupProxy()
  await validateProductionConfig()
  const server = Hapi.server(createServerConfig())
  await registerCorePlugins(server)
  await registerScheduler(server)
  await registerSwagger(server)
  return server
}

export { createServer }
