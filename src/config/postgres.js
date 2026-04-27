import { isProduction } from './environment.js'

const postgresSchema = {
  postgres: {
    host: {
      doc: 'PostgreSQL database host',
      format: String,
      default: '127.0.0.1',
      env: 'DB_HOST'
    },
    port: {
      doc: 'PostgreSQL database port',
      format: 'port',
      default: 5432,
      env: 'DB_PORT'
    },
    database: {
      doc: 'PostgreSQL database name',
      format: String,
      default: 'pafs',
      env: 'DB_DATABASE'
    },
    username: {
      doc: 'PostgreSQL username',
      format: String,
      default: 'postgres',
      env: 'DB_USERNAME'
    },
    password: {
      doc: 'PostgreSQL password (only used for local development, not with IAM auth)',
      format: String,
      default: 'postgres',
      sensitive: true,
      env: 'DB_PASSWORD'
    },
    useIamAuth: {
      doc: 'Use AWS IAM authentication with short-lived tokens (auto-enabled in production)',
      format: Boolean,
      default: isProduction,
      env: 'DB_USE_IAM_AUTHENTICATION'
    },
    pool: {
      max: {
        doc: 'Maximum number of connections in pool',
        format: 'nat',
        default: 10,
        env: 'POSTGRES_POOL_MAX'
      },
      maxLifetimeSeconds: {
        doc: 'Maximum lifetime of a connection in seconds (important for IAM token refresh)',
        format: 'nat',
        default: 10 * 60,
        env: 'POSTGRES_POOL_MAX_LIFETIME'
      }
    }
  }
}

export { postgresSchema }
