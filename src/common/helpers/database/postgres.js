import pg from 'pg'
import { generateRdsAuthToken } from './rds-auth.js'

const { Pool } = pg

/**
 * Create password getter function
 * For AWS: generates fresh IAM token on each connection
 * For local: returns static password
 */
function createPasswordProvider(server, options) {
  if (options.useIamAuth) {
    server.logger.info('Using AWS IAM authentication with short-lived tokens')
    // Return a function that generates a fresh token each time
    return async () => {
      const token = await generateRdsAuthToken(options)
      server.logger.debug('Generated new RDS IAM auth token')
      return token
    }
  } else {
    server.logger.info('Using static password authentication')
    // Return the static password
    return options.password
  }
}

export const postgres = {
  plugin: {
    name: 'postgres',
    version: '1.0.0',
    register: async function (server, options) {
      server.logger.info('Setting up PostgreSQL connection pool')

      // Get password provider (function for IAM auth, string for local)
      const passwordProvider = createPasswordProvider(server, options)

      // Build connection configuration following CDP patterns
      const poolConfig = {
        host: options.host,
        port: options.port,
        database: options.database,
        user: options.username,
        password: passwordProvider,
        max: options.pool.max,
        maxLifetimeSeconds: options.pool.maxLifetimeSeconds,
        connectionTimeoutMillis: 10000, // 10 seconds to establish connection
        idleTimeoutMillis: 30000 // 30 seconds before closing idle connection
      }

      // SSL is required for AWS RDS IAM authentication
      // For local development without IAM auth, SSL is disabled
      if (options.useIamAuth) {
        poolConfig.ssl = server.secureContext
          ? {
              rejectUnauthorized: false,
              secureContext: server.secureContext
            }
          : {
              rejectUnauthorized: false
            }
        server.logger.info(
          'SSL enabled (required for AWS RDS IAM authentication)'
        )
      }

      // Create connection pool
      const pool = new Pool(poolConfig)

      // Handle pool errors
      pool.on('error', (err, client) => {
        server.logger.error(
          { err, clientId: client?.processID },
          'Unexpected error on idle PostgreSQL client'
        )
      })

      server.logger.info('PostgreSQL pool configured successfully')
      console.log(poolConfig)
      // Test connection on startup
      try {
        server.logger.info('Testing PostgreSQL connection...')
        const client = await pool.connect()
        await client.query('SELECT 1')
        client.release()
        server.logger.info('PostgreSQL connection test successful')
      } catch (err) {
        server.logger.error({ err }, 'Failed to connect to PostgreSQL')
        await pool.end()
        throw err
      }

      // Decorate server and request with pool access
      server.decorate('server', 'pg', pool)
      server.decorate('request', 'pg', () => pool, { apply: true })

      // Decorate request with pgQuery helper
      server.decorate('request', 'pgQuery', async function (sql, params) {
        const start = Date.now()
        const result = await pool.query(sql, params)
        const duration = Date.now() - start
        return { ...result, duration }
      })

      // Graceful shutdown
      server.events.on('stop', async () => {
        server.logger.info('Closing PostgreSQL pool')
        try {
          await pool.end()
          server.logger.info('PostgreSQL pool closed successfully')
        } catch (err) {
          server.logger.error({ err }, 'Error closing PostgreSQL pool')
        }
      })
    }
  }
}
