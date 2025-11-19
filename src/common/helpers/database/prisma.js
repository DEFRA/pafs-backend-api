import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Liquibase manages schema, Prisma provides type-safe ORM
// Schema introspection (prisma:db:pull) only needed during development

let prismaInstance = null
let pgPool = null

export function getPrismaClient(options) {
  if (prismaInstance) {
    return prismaInstance
  }

  const { datasourceUrl, logger } = options
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isProduction = process.env.NODE_ENV === 'production'

  const logConfig = [
    { emit: 'event', level: 'error' },
    ...(isDevelopment
      ? [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' }
      ]
      : [])
  ]

  pgPool = new pg.Pool({ connectionString: datasourceUrl })
  const adapter = new PrismaPg(pgPool)

  prismaInstance = new PrismaClient({
    log: logConfig,
    errorFormat: isProduction ? 'minimal' : 'pretty',
    adapter
  })

  if (logger) {
    if (isDevelopment) {
      prismaInstance.$on('query', (e) => {
        logger.debug(
          { query: e.query, params: e.params, duration: e.duration },
          'Prisma query'
        )
      })
    }

    prismaInstance.$on('error', (e) => logger.error({ err: e }, 'Prisma error'))
    prismaInstance.$on('warn', (e) =>
      logger.warn({ warning: e }, 'Prisma warning')
    )
  }

  return prismaInstance
}

export async function disconnectPrisma() {
  if (prismaInstance) {
    await prismaInstance.$disconnect()
    prismaInstance = null
  }
  if (pgPool) {
    await pgPool.end()
    pgPool = null
  }
}
