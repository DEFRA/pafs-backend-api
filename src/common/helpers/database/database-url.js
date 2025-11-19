import { DB_DEFAULTS } from '../../constants'

function getConfigValue(optionValue, envValue, defaultValue) {
  return optionValue || envValue || defaultValue
}

export function buildDatabaseUrl(options = {}) {
  const dbHost = getConfigValue(
    options.host,
    process.env.DB_HOST,
    DB_DEFAULTS.HOST
  )
  const dbPort = getConfigValue(
    options.port,
    process.env.DB_PORT,
    DB_DEFAULTS.PORT
  )
  const dbDatabase = getConfigValue(
    options.database,
    process.env.DB_DATABASE,
    DB_DEFAULTS.DATABASE
  )
  const dbUsername = getConfigValue(
    options.username,
    process.env.DB_USERNAME,
    DB_DEFAULTS.USERNAME
  )
  const dbPassword = options.password || process.env.DB_PASSWORD
  const schema = getConfigValue(options.schema, undefined, DB_DEFAULTS.SCHEMA)

  if (!dbPassword) {
    throw new Error('Database password is required. Provide via DB_PASSWORD environment variable or options.password')
  }

  return `postgresql://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/${dbDatabase}?schema=${schema}`
}
