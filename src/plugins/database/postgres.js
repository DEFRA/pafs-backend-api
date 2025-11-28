import pg from 'pg'
import { buildRdsPoolConfig } from './helpers/build-rds-pool-config.js'

const { Pool } = pg

export const postgres = {
  plugin: {
    name: 'postgres',
    version: '1.0.0',
    register: async function (server, options) {
      server.logger.info('Setting up PostgreSQL connection pool')

      // Build complete pool configuration (includes password provider, SSL, timeouts, etc.)
      const poolConfig = buildRdsPoolConfig(server, options)

      // Create connection pool with the built configuration
      const pool = new Pool(poolConfig)

      // Handle pool errors
      pool.on('error', (err, client) => {
        server.logger.error(
          { err, clientId: client?.processID },
          'Unexpected error on idle PostgreSQL client'
        )
      })

      server.logger.info('PostgreSQL pool configured successfully')

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
