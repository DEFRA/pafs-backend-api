import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../../../config.js'

/**
 * S3 Service for file operations
 * Handles presigned URLs and file downloads from S3
 */
export class S3Service {
  constructor(logger) {
    this.logger = logger
    this.region = config.get('awsRegion')
    this.endpoint = config.get('cdpUploader.s3Endpoint')

    // Configure S3 client
    const clientConfig = {
      region: this.region,
      forcePathStyle: !!this.endpoint // Required for localstack
    }

    if (this.endpoint) {
      clientConfig.endpoint = this.endpoint
    }

    this.s3Client = new S3Client(clientConfig)

    this.logger.info(
      {
        region: this.region,
        endpoint: this.endpoint || 'AWS default'
      },
      'S3 Service initialized'
    )
  }

  /**
   * Generate a presigned URL for downloading a file from S3
   *
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 object key
   * @param {number} expiresIn - URL expiration time in seconds (default: 900 = 15 minutes)
   * @returns {Promise<string>} Presigned URL
   */
  async getPresignedDownloadUrl(bucket, key, expiresIn = 900) {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })

      const url = await getSignedUrl(this.s3Client, command, { expiresIn })

      this.logger.info(
        {
          bucket,
          key,
          expiresIn
        },
        'Generated presigned download URL'
      )

      return url
    } catch (error) {
      this.logger.error(
        {
          err: error,
          bucket,
          key
        },
        'Failed to generate presigned download URL'
      )
      throw error
    }
  }

  /**
   * Get service configuration
   *
   * @returns {Object} Configuration details
   */
  getServiceStatus() {
    return {
      region: this.region,
      endpoint: this.endpoint,
      mode: this.useLocalstack ? 'localstack' : 'aws'
    }
  }
}

// Singleton instance
let s3ServiceInstance = null

/**
 * Get or create S3 Service instance
 *
 * @param {Object} logger - Logger instance
 * @returns {S3Service} Service instance
 */
export function getS3Service(logger) {
  if (!s3ServiceInstance) {
    s3ServiceInstance = new S3Service(logger)
  }
  return s3ServiceInstance
}

/**
 * Reset service instance (useful for testing)
 */
export function resetS3Service() {
  s3ServiceInstance = null
}
