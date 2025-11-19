import { PrismaClient } from '@prisma/client'

// Liquibase manages schema, Prisma provides type-safe ORM
// Schema introspection (prisma:db:pull) only needed during development

let prismaInstance = null

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

  prismaInstance = new PrismaClient({
    log: logConfig,
    errorFormat: isProduction ? 'minimal' : 'pretty',
    datasources: { db: { url: datasourceUrl } }
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
}
