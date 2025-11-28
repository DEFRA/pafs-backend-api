import { Signer } from '@aws-sdk/rds-signer'
import { fromNodeProviderChain } from '@aws-sdk/credential-providers'

/**
 * Generate AWS RDS IAM authentication token
 * Tokens are valid for 15 minutes
 *
 * @param {Object} config - Configuration for token generation
 * @param {string} config.host - RDS hostname
 * @param {number} config.port - RDS port
 * @param {string} config.awsRegion - AWS region
 * @param {string} config.username - Database username
 * @returns {Promise<string>} Authentication token
 */
export async function generateRdsAuthToken(config) {
  const signer = new Signer({
    hostname: config.host,
    port: config.port,
    region: config.awsRegion,
    username: config.username,
    credentials: fromNodeProviderChain()
  })
  return signer.getAuthToken()
}

/**
 * Build PostgreSQL pool configuration for RDS with IAM authentication support
 * Handles both AWS IAM authentication and static password authentication
 *
 * For AWS IAM auth:
 * - Creates a password function that generates fresh tokens on each new connection
 * - Configures SSL (required for IAM auth)
 * - Sets maxLifetimeSeconds to rotate connections before tokens expire (15 min)
 *
 * For static password:
 * - Uses the provided password string directly
 *
 * @param {Object} server - Hapi server instance for logging
 * @param {Object} options - Database configuration options
 * @param {string} options.host - Database host
 * @param {number} options.port - Database port
 * @param {string} options.database - Database name
 * @param {string} options.username - Database username
 * @param {string} [options.password] - Static password (for non-IAM auth)
 * @param {boolean} options.useIamAuth - Whether to use IAM authentication
 * @param {string} [options.awsRegion] - AWS region (required for IAM auth)
 * @param {Object} options.pool - Pool configuration
 * @param {number} options.pool.max - Maximum pool size
 * @param {number} options.pool.maxLifetimeSeconds - Max connection lifetime
 * @returns {Object} Complete pg.Pool configuration
 */
export function buildRdsPoolConfig(server, options) {
  server.logger.info('Building RDS PostgreSQL pool configuration')

  // Create password provider based on authentication method
  let passwordProvider
  if (options.useIamAuth) {
    server.logger.info(
      'Using AWS RDS IAM authentication with short-lived tokens'
    )
    server.logger.info(
      `Token rotation enabled: connections will refresh every ${options.pool.maxLifetimeSeconds} seconds`
    )
    // Return a function that generates a fresh token each time a new connection is created
    passwordProvider = async () => {
      const token = await generateRdsAuthToken(options)
      server.logger.debug('Generated new RDS IAM auth token')
      return token
    }
  } else {
    server.logger.info('Using static password authentication')
    passwordProvider = options.password
  }

  // Build base pool configuration
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

  // Add SSL configuration for AWS RDS IAM authentication
  if (options.useIamAuth) {
    poolConfig.ssl = server.secureContext
      ? {
          rejectUnauthorized: false,
          secureContext: server.secureContext
        }
      : {
          rejectUnauthorized: false
        }
    server.logger.info('SSL enabled (required for AWS RDS IAM authentication)')
  }

  return poolConfig
}
