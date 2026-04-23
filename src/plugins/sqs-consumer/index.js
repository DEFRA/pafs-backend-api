import { Consumer } from 'sqs-consumer'
import { DeleteMessageCommand } from '@aws-sdk/client-sqs'
import { config } from '../../config.js'
import {
  runAdminGeneration,
  runUserGeneration
} from '../downloads/programme/programme-service.js'

const GENERATION_TYPE_ADMIN = 'admin'

async function handleGenerationMessage(message, server) {
  const { prisma, logger } = server
  const payload = JSON.parse(message.Body)
  const downloadId = BigInt(payload.downloadId)
  const params = { ...payload, downloadId, prisma, logger }

  if (payload.type === GENERATION_TYPE_ADMIN) {
    await runAdminGeneration(params)
  } else {
    await runUserGeneration(params)
  }
}

export const sqsProgrammeConsumerPlugin = {
  name: 'sqsProgrammeConsumer',
  version: '1.0.0',
  async register(server) {
    const { sqs, logger } = server
    const queueUrl = config.get('sqsProgrammeGeneration.queueUrl')

    const consumer = Consumer.create({
      queueUrl,
      waitTimeSeconds: config.get('sqsProgrammeGeneration.waitTimeSeconds'),
      visibilityTimeout: config.get('sqsProgrammeGeneration.visibilityTimeout'),
      shouldDeleteMessages: false,
      batchSize: 1,
      sqs,
      handleMessage: async (message) => {
        await handleGenerationMessage(message, server)
        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle
          })
        )
      }
    })

    consumer.on('error', (err) => logger.error({ err }, 'SQS consumer error'))
    consumer.on('processing_error', (err) =>
      logger.error({ err }, 'SQS consumer processing error')
    )
    consumer.on('timeout_error', (err) =>
      logger.error({ err }, 'SQS consumer timeout error')
    )

    server.ext('onPostStart', () => {
      consumer.start()
      logger.info({ queueUrl }, 'SQS programme generation consumer started')
    })

    // 'closing' not 'stop' — ensures in-flight messages complete before shutdown
    server.events.on('closing', () => {
      logger.info('Stopping SQS programme generation consumer')
      consumer.stop()
    })
  }
}
