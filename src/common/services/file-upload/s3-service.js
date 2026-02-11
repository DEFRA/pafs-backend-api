import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3'
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
        endpoint: this.endpoint
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
   * @param {string} filename - Optional filename for Content-Disposition header
   * @returns {Promise<string>} Presigned URL
   */
  async getPresignedDownloadUrl(bucket, key, expiresIn = 900, filename = null) {
    try {
      const commandInput = {
        Bucket: bucket,
        Key: key
      }

      // Add Content-Disposition header if filename is provided
      if (filename) {
        // RFC 6266: Use filename* for UTF-8 encoded filenames
        const encodedFilename = encodeURIComponent(filename)
        commandInput.ResponseContentDisposition = `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`
      }

      const command = new GetObjectCommand(commandInput)

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
   * Get a file object from S3
   *
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 object key
   * @returns {Promise<Buffer>} File contents as Buffer
   */
  async getObject(bucket, key) {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })

      const response = await this.s3Client.send(command)

      // Convert stream to buffer
      const chunks = []
      for await (const chunk of response.Body) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)

      this.logger.info(
        {
          bucket,
          key,
          size: buffer.length
        },
        'Successfully retrieved S3 object'
      )

      return buffer
    } catch (error) {
      this.logger.error(
        {
          err: error,
          bucket,
          key
        },
        'Failed to retrieve S3 object'
      )
      throw error
    }
  }

  /**
   * Delete an object from S3
   *
   * @param {string} bucket - S3 bucket name
   * @param {string} key - S3 object key
   * @returns {Promise<void>}
   */
  async deleteObject(bucket, key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      })

      await this.s3Client.send(command)

      this.logger.info({ bucket, key }, 'Successfully deleted S3 object')
    } catch (error) {
      this.logger.error(
        {
          err: error,
          bucket,
          key
        },
        'Failed to delete S3 object'
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
      endpoint: this.endpoint
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
