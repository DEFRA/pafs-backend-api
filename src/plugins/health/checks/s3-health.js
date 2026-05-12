import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3'
import { config } from '../../../config.js'

/**
 * Check S3 bucket reachability via a lightweight HeadBucket call.
 * Creates a short-lived client and destroys it after the check.
 * @returns {Promise<{healthy: boolean, status: string, responseTime?: number, error?: string}>}
 */
export async function checkS3Health() {
  const enabled = config.get('cdpUploader.enabled')

  if (!enabled) {
    return {
      status: 'disabled',
      healthy: true,
      message: 'S3 upload is disabled'
    }
  }

  const bucket = config.get('cdpUploader.s3Bucket')
  const region = config.get('awsRegion')
  const endpoint = config.get('cdpUploader.s3Endpoint')

  const clientConfig = { region, forcePathStyle: !!endpoint }
  if (endpoint) {
    clientConfig.endpoint = endpoint
  }

  const client = new S3Client(clientConfig)

  try {
    const start = Date.now()
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
    return {
      status: 'connected',
      healthy: true,
      responseTime: Date.now() - start
    }
  } catch (err) {
    return { status: 'error', healthy: false, error: err.message }
  } finally {
    client.destroy()
  }
}
