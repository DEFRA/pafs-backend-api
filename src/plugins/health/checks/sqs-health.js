import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs'
import { config } from '../../../config.js'

/**
 * Check SQS queue reachability by fetching a single queue attribute.
 * Reuses the SQS client decorated on the server to avoid creating a new connection.
 * @param {Object} request - Hapi request object (provides access to server.sqs)
 * @returns {Promise<{healthy: boolean, status: string, responseTime?: number, error?: string}>}
 */
export async function checkSqsHealth(request) {
  const queueUrl = config.get('sqsProgrammeGeneration.queueUrl')

  try {
    const start = Date.now()
    await request.server.sqs.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['QueueArn']
      })
    )
    return {
      status: 'connected',
      healthy: true,
      responseTime: Date.now() - start
    }
  } catch (err) {
    return { status: 'error', healthy: false, error: err.message }
  }
}
