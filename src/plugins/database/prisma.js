import {
  getPrismaClient,
  disconnectPrisma
} from '../../common/helpers/database/prisma.js'
import { generateRdsAuthToken } from '../../common/helpers/database/rds-auth.js'

async function buildDatabaseUrl(pgConfig, awsRegion, logger) {
  const { host, port, database, username, password, useIamAuth } = pgConfig

  if (useIamAuth) {
    logger.info('Prisma using AWS RDS IAM authentication')

    if (!awsRegion) {
      throw new Error('AWS_REGION is required for IAM authentication')
    }

    const token = await generateRdsAuthToken({
      host,
      port: Number.parseInt(port, 10),
      username,
      awsRegion
    })
    logger.info(
      { host, port, database, username, useIamAuth, awsRegion, token },
      'Database configuration'
    )

    return `postgresql://${username}:${token}@${host}:${port}/${database}?schema=public&connection_limit=1`
  }

  logger.info('Prisma using static password authentication')
  return `postgresql://${username}:${password}@${host}:${port}/${database}?schema=public`
}

export const prismaPlugin = {
  name: 'prisma',
  version: '1.0.0',

  async register(server, options = {}) {
    server.logger.info('Initializing Prisma ORM')

    try {
      const pgConfig = options.postgres || {}
      const awsRegion = options.awsRegion || process.env.AWS_REGION

      const datasourceUrl = await buildDatabaseUrl(
        pgConfig,
        awsRegion,
        server.logger
      )

      const prismaClient = getPrismaClient({
        datasourceUrl,
        logger: server.logger
      })

      server.logger.info('Testing Prisma connection...')
      await prismaClient.$queryRaw`SELECT 1`
      server.logger.info('Prisma connection successful')

      server.decorate('server', 'prisma', prismaClient)
      server.decorate('request', 'prisma', () => prismaClient, { apply: true })

      server.events.on('stop', async () => {
        server.logger.info('Disconnecting Prisma...')
        try {
          await disconnectPrisma()
          server.logger.info('Prisma disconnected')
        } catch (error) {
          server.logger.error({ err: error }, 'Error disconnecting Prisma')
        }
      })

      server.logger.info('Prisma plugin registered')
    } catch (error) {
      server.logger.error({ err: error }, 'Failed to initialize Prisma')
      throw error
    }
  }
}

export default prismaPlugin
