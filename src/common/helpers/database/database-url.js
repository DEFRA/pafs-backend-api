export function buildDatabaseUrl(options = {}) {
  const dbHost = options.host || process.env.DB_HOST || '127.0.0.1'
  const dbPort = options.port || process.env.DB_PORT || '5432'
  const dbDatabase =
    options.database || process.env.DB_DATABASE || 'pafs_backend_api'
  const dbUsername = options.username || process.env.DB_USERNAME || 'postgres'
  const dbPassword = options.password || process.env.DB_PASSWORD || 'pgadmin'
  const schema = options.schema || 'public'

  return `postgresql://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/${dbDatabase}?schema=${schema}`
}
