import Hapi from '@hapi/hapi'

import { secureContext } from '@defra/hapi-secure-context'

import { config } from './config.js'
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

async function createServer() {
  setupProxy()
  const server = Hapi.server({
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
  })

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
    healthPlugin,
    authPlugin,
    areasPlugin,
    accountsPlugin,
    emailValidationPlugin,
    projectsPlugin,
    fileUploadPlugin
  ])

  // Register scheduler after other plugins so logger is available
  const tasks = await loadTasks(server.logger)
  await server.register({
    plugin: schedulerPlugin,
    options: { tasks }
  })

  return server
}

export { createServer }
