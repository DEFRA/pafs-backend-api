import { DB_DEFAULTS } from '../../constants'
export function buildDatabaseUrl(options = {}) {
  const dbHost = options.host || process.env.DB_HOST || DB_DEFAULTS.HOST
  const dbPort = options.port || process.env.DB_PORT || DB_DEFAULTS.PORT
  const dbDatabase =
    options.database || process.env.DB_DATABASE || DB_DEFAULTS.DATABASE
  const dbUsername =
    options.username || process.env.DB_USERNAME || DB_DEFAULTS.USERNAME
  const dbPassword =
    options.password || process.env.DB_PASSWORD || DB_DEFAULTS.PASSWORD
  const schema = options.schema || DB_DEFAULTS.SCHEMA

  return `postgresql://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/${dbDatabase}?schema=${schema}`
}
