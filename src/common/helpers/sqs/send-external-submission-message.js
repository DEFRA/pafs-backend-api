import { SendMessageCommand } from '@aws-sdk/client-sqs'
import { config } from '../../../config.js'

/**
 * Enqueue an external submission job on SQS.
 *
 * The consumer will reload fresh project data from the database and forward
 * the proposal to the external system (AIMS PD). Keeping only the reference
 * number and project ID in the message avoids storing sensitive project data
 * in SQS.
 *
 * @param {import('@aws-sdk/client-sqs').SQSClient} sqsClient
 * @param {string} referenceNumber
 * @param {bigint} projectId
 * @returns {Promise<void>}
 */
export async function sendExternalSubmissionMessage(
  sqsClient,
  referenceNumber,
  projectId
) {
  const command = new SendMessageCommand({
    QueueUrl: config.get('sqsExternalSubmission.queueUrl'),
    MessageBody: JSON.stringify({
      referenceNumber,
      projectId: projectId.toString()
    })
  })
  await sqsClient.send(command)
}
