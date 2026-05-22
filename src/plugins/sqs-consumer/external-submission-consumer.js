import { Consumer } from 'sqs-consumer'
import { DeleteMessageCommand } from '@aws-sdk/client-sqs'
import { config } from '../../config.js'
import { ProjectService } from '../projects/services/project-service.js'
import { lookupCreatorEmail } from '../projects/helpers/lookup-creator-email.js'
import {
  buildProposalPayload,
  fetchShapefileBase64
} from '../projects/helpers/proposal-payload-builder.js'
import { validateProposalPayload } from '../projects/helpers/proposal-payload-validator.js'
import { ExternalSubmissionService } from '../../common/services/external-submission/external-submission-service.js'

/**
 * Build and send the proposal payload to the external system.
 *
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {import('pino').Logger} params.logger
 * @param {object} params.project
 * @param {string} params.referenceNumber
 * @param {bigint} params.projectId
 */
async function sendToExternalSystem({
  prisma,
  logger,
  project,
  referenceNumber,
  projectId
}) {
  const creatorEmail = await lookupCreatorEmail(prisma, referenceNumber, logger)
  const shapefileBase64 = await fetchShapefileBase64(project, logger)
  const payload = buildProposalPayload(project, creatorEmail, shapefileBase64)

  validateProposalPayload(payload, referenceNumber, logger)

  const submissionService = new ExternalSubmissionService(prisma, logger)
  const result = await submissionService.send({
    projectId,
    referenceNumber,
    payload,
    isResend: false
  })

  if (!result.success) {
    logger.warn(
      { referenceNumber, error: result.error, httpStatus: result.httpStatus },
      'External submission failed — project submitted in PAFS but not yet in external system'
    )
  }
}

/**
 * Process a single external submission message.
 *
 * @param {object} params
 * @param {import('@prisma/client').PrismaClient} params.prisma
 * @param {import('pino').Logger} params.logger
 * @param {string} params.referenceNumber
 * @param {bigint} params.projectId
 */
async function processMessage({ prisma, logger, referenceNumber, projectId }) {
  const projectService = new ProjectService(prisma, logger)
  const project = await projectService.getProjectForSubmission(referenceNumber)

  if (!project) {
    logger.error(
      { referenceNumber },
      'Project not found for external submission — skipping'
    )
    return
  }

  logger.info(
    { referenceNumber },
    'Processing external submission from SQS queue'
  )

  await sendToExternalSystem({
    prisma,
    logger,
    project,
    referenceNumber,
    projectId
  })
}

/**
 * Parse the SQS message body and dispatch to processMessage.
 *
 * @param {import('@aws-sdk/client-sqs').Message} message
 * @param {import('@hapi/hapi').Server} server
 */
async function handleMessage(message, server) {
  const { referenceNumber, projectId: projectIdStr } = JSON.parse(message.Body)
  await processMessage({
    prisma: server.prisma,
    logger: server.logger,
    referenceNumber,
    projectId: BigInt(projectIdStr)
  })
}

/**
 * Attach error-event listeners to the consumer.
 *
 * @param {Consumer} consumer
 * @param {import('pino').Logger} logger
 */
function attachConsumerListeners(consumer, logger) {
  consumer.on('error', (err) =>
    logger.error({ err }, 'External submission SQS consumer error')
  )
  consumer.on('processing_error', (err) =>
    logger.error({ err }, 'External submission SQS processing error')
  )
  consumer.on('timeout_error', (err) =>
    logger.error({ err }, 'External submission SQS timeout error')
  )
}

export const sqsExternalSubmissionConsumerPlugin = {
  name: 'sqsExternalSubmissionConsumer',
  version: '1.0.0',

  async register(server) {
    const { sqs, logger } = server
    const queueUrl = config.get('sqsExternalSubmission.queueUrl')

    const consumer = Consumer.create({
      queueUrl,
      waitTimeSeconds: config.get('sqsExternalSubmission.waitTimeSeconds'),
      visibilityTimeout: config.get('sqsExternalSubmission.visibilityTimeout'),
      shouldDeleteMessages: false,
      batchSize: 1,
      sqs,
      handleMessage: async (message) => {
        await handleMessage(message, server)
        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle
          })
        )
        return message
      }
    })

    attachConsumerListeners(consumer, logger)

    server.ext('onPostStart', () => {
      consumer.start()
      logger.info({ queueUrl }, 'SQS external submission consumer started')
    })

    // 'closing' not 'stop' — ensures in-flight messages complete before shutdown
    server.events.on('closing', () => {
      logger.info('Stopping SQS external submission consumer')
      consumer.stop()
    })
  }
}
