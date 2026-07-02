import { CONFIG_DEFAULTS } from '../common/constants/common.js'
import { isProduction } from './environment.js'

const postgresSchema = {
  postgres: {
    writerHost: {
      doc: 'PostgreSQL writer endpoint host',
      format: String,
      default: '127.0.0.1',
      env: 'DB_WRITER_HOST'
    },
    readerHost: {
      doc: 'PostgreSQL read-replica endpoint host (Aurora reader endpoint). When empty the reader pool targets the writer host, which is safe for local development.',
      format: String,
      default: '',
      env: 'DB_READER_HOST'
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
      default: CONFIG_DEFAULTS.CHANGEME_IN_DEVELOPMENT,
      env: 'DB_DATABASE'
    },
    username: {
      doc: 'PostgreSQL username',
      format: String,
      default: CONFIG_DEFAULTS.CHANGEME_IN_DEVELOPMENT,
      env: 'DB_USERNAME'
    },
    password: {
      doc: 'PostgreSQL password (only used for local development, not with IAM auth)',
      format: String,
      default: CONFIG_DEFAULTS.CHANGEME_IN_DEVELOPMENT,
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
      writerMax: {
        doc: 'Maximum connections in the writer pool',
        format: 'nat',
        default: 20,
        env: 'POSTGRES_WRITER_POOL_MAX'
      },
      readerMax: {
        doc: 'Maximum connections in the reader (replica) pool',
        format: 'nat',
        default: 30,
        env: 'POSTGRES_READER_POOL_MAX'
      },
      maxLifetimeSeconds: {
        doc: 'Maximum lifetime of a connection in seconds (important for IAM token refresh)',
        format: 'nat',
        default: 10 * 60,
        env: 'POSTGRES_POOL_MAX_LIFETIME'
      },
      connectionTimeoutMs: {
        doc: 'Milliseconds before pg times out waiting for a pool slot or an Aurora query response — must exceed worst-case Aurora response time under load',
        format: 'nat',
        default: 5000,
        env: 'POSTGRES_POOL_CONNECTION_TIMEOUT_MS'
      }
    }
  }
}

export { postgresSchema }
