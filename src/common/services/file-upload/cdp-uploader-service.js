import { config } from '../../../config.js'
import fetch from 'node-fetch'
import { UPLOAD_STATUS, FILE_STATUS } from '../../constants/index.js'

/**
 * CDP Uploader Service
 * Handles integration with the CDP file upload and virus scanning service
 * In local development, can work directly with localstack S3 instead of CDP Uploader
 *
 * @class CdpUploaderService
 */
export class CdpUploaderService {
  constructor(logger) {
    this.logger = logger
    this.enabled = config.get('cdpUploader.enabled')
    this.baseUrl = config.get('cdpUploader.baseUrl')
    this.s3Bucket = config.get('cdpUploader.s3Bucket')
    this.s3Path = config.get('cdpUploader.s3Path')
    this.maxFileSize = config.get('cdpUploader.maxFileSize')
    this.allowedMimeTypes = config
      .get('cdpUploader.allowedMimeTypes')
      .split(',')
    this.timeout = config.get('cdpUploader.timeout')
    this.useLocalstack = config.get('cdpUploader.useLocalstack')
    this.s3Endpoint = config.get('cdpUploader.s3Endpoint')
    this.awsRegion = config.get('awsRegion')

    if (this.enabled) {
      const mode = this.useLocalstack ? 'localstack' : 'CDP Uploader'
      this.logger.info(
        {
          mode,
          baseUrl: this.baseUrl,
          s3Bucket: this.s3Bucket,
          s3Endpoint: this.s3Endpoint
        },
        `CDP Uploader service initialized (${mode} mode)`
      )
    } else {
      this.logger.warn('CDP Uploader disabled')
    }
  }

  /**
   * Initiate a file upload session with CDP Uploader (or localstack in local mode)
   *
   * @param {Object} options - Upload options
   * @param {string} options.redirect - Relative URL to redirect after upload
   * @param {string} options.callback - Full callback URL for upload notifications
   * @param {Object} options.metadata - Custom metadata to attach to the upload
   * @param {string[]} [options.downloadUrls] - Optional array of URLs for CDP to download files from
   * @returns {Promise<Object>} Upload session details with uploadId, uploadUrl, and statusUrl
   */
  async initiate({ redirect, callback, metadata, downloadUrls }) {
    if (!this.enabled) {
      this.logger.warn('CDP Uploader disabled - returning mock response')
      return this.getMockInitiateResponse(metadata)
    }

    // In localstack mode, we bypass CDP Uploader and return direct S3 upload URL
    if (this.useLocalstack) {
      return this.initiateLocalstackUpload({ redirect, metadata })
    }

    const payload = {
      redirect,
      callback,
      s3Bucket: this.s3Bucket,
      metadata: metadata || {},
      mimeTypes: this.allowedMimeTypes,
      maxFileSize: this.maxFileSize
    }

    if (this.s3Path) {
      payload.s3Path = this.s3Path
    }

    if (downloadUrls && downloadUrls.length > 0) {
      payload.downloadUrls = downloadUrls
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(`${this.baseUrl}/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `CDP Uploader initiate failed: ${response.status} - ${errorText}`
        )
      }

      const data = await response.json()

      this.logger.info(
        {
          uploadId: data.uploadId,
          hasDownloadUrls: !!downloadUrls
        },
        'Upload session initiated'
      )

      return data
    } catch (error) {
      this.logger.error(
        {
          err: error,
          metadata
        },
        'Failed to initiate upload'
      )
      throw error
    }
  }

  /**
   * Initiate upload for localstack mode (bypasses CDP Uploader)
   * @private
   */
  initiateLocalstackUpload({ _redirect, metadata }) {
    const uploadId = this.generateUploadId()

    // In localstack mode, return mock ready status (no virus scanning)
    if (this.useLocalstack) {
      this.logger.debug(
        { uploadId },
        'Localstack mode - returning ready status'
      )
      return this.getMockStatusResponse(uploadId)
    }

    this.logger.info(
      {
        uploadId,
        mode: 'localstack'
      },
      'Localstack upload session initiated'
    )

    return {
      uploadId,
      uploadUrl: `/upload-and-scan/${uploadId}`,
      statusUrl: `${this.baseUrl}/status/${uploadId}`,
      metadata: metadata || {},
      localstack: true
    }
  }

  /**
   * Check the status of an upload from CDP Uploader
   *
   * @param {string} uploadId - The upload ID to check
   * @returns {Promise<Object>} Upload status details from CDP Uploader
   */
  async getUploadStatus(uploadId) {
    if (!this.enabled) {
      this.logger.warn('CDP Uploader disabled - returning mock status')
      return this.getMockStatusResponse(uploadId)
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(`${this.baseUrl}/status/${uploadId}`, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `CDP Uploader status check failed: ${response.status} - ${errorText}`
        )
      }

      const data = await response.json()

      this.logger.debug(
        {
          uploadId,
          uploadStatus: data.uploadStatus
        },
        'Upload status retrieved'
      )

      return data
    } catch (error) {
      this.logger.error(
        {
          err: error,
          uploadId
        },
        'Failed to get upload status'
      )
      throw error
    }
  }

  /**
   * Get the full upload URL by combining frontend base URL with upload path
   *
   * @param {string} uploadUrl - Relative upload URL from CDP Uploader
   * @param {string} frontendBaseUrl - Frontend base URL
   * @returns {string} Full upload URL
   */
  buildUploadUrl(uploadUrl, frontendBaseUrl) {
    const baseUrl = frontendBaseUrl.replace(/\/$/, '')
    const path = uploadUrl.startsWith('/') ? uploadUrl : `/${uploadUrl}`
    return `${baseUrl}${path}`
  }

  /**
   * Get service configuration status
   *
   * @returns {Object} Service configuration details
   */
  getServiceStatus() {
    return {
      enabled: this.enabled,
      baseUrl: this.baseUrl,
      s3Bucket: this.s3Bucket,
      s3Path: this.s3Path,
      mode: this.useLocalstack ? 'localstack' : 'cdp-uploader',
      s3Endpoint: this.s3Endpoint
    }
  }

  /**
   * Generate a unique upload ID
   * @private
   */
  generateUploadId() {
    const timestamp = Date.now()
    const base = 36
    const endIndex = 15
    const random = Math.random().toString(base).substring(2, endIndex)
    return `${timestamp}-${random}`
  }

  /**
   * Generate mock initiate response for testing
   * @private
   */
  getMockInitiateResponse(metadata) {
    const uploadId = this.generateUploadId()
    return {
      uploadId,
      uploadUrl: `/upload-and-scan/${uploadId}`,
      statusUrl: `${this.baseUrl}/status/${uploadId}`,
      metadata: metadata || {}
    }
  }

  /**
   * Generate mock status response for testing
   * @private
   */
  getMockStatusResponse(uploadId) {
    return {
      uploadStatus: UPLOAD_STATUS.READY,
      metadata: {},
      form: {
        file: {
          fileId: `file-${Date.now()}`,
          filename: 'test-file.pdf',
          contentType: 'application/pdf',
          fileStatus: FILE_STATUS.SCANNED,
          contentLength: 12345,
          s3Key: `${this.s3Path}${uploadId}/mock-file`,
          s3Bucket: this.s3Bucket
        }
      },
      numberOfRejectedFiles: 0
    }
  }
}

// Singleton instance
let cdpUploaderServiceInstance = null

/**
 * Get or create CDP Uploader service instance
 *
 * @param {Object} logger - Logger instance
 * @returns {CdpUploaderService} Service instance
 */
export function getCdpUploaderService(logger) {
  if (!cdpUploaderServiceInstance) {
    cdpUploaderServiceInstance = new CdpUploaderService(logger)
  }
  return cdpUploaderServiceInstance
}

/**
 * Reset service instance (useful for testing)
 */
export function resetCdpUploaderService() {
  cdpUploaderServiceInstance = null
}
