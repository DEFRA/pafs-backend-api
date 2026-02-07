import { getS3Service } from '../../../common/services/file-upload/s3-service.js'
import {
  DOWNLOAD_URL_EXPIRES_IN,
  HTTP_STATUS
} from '../../../common/constants/index.js'
import { validateProjectWithBenefitAreaFile } from './benefit-area-validation-helper.js'
import { buildValidationErrorResponse } from '../../../common/helpers/response-builder.js'

/**
 * Common handler wrapper for benefit area file operations
 * Handles validation and error handling consistently
 */
export async function withBenefitAreaFileValidation(
  request,
  h,
  operation,
  errorCode,
  operationName,
  logName = null
) {
  const { logger } = request.server

  try {
    const validation = await validateProjectWithBenefitAreaFile(request, h)
    if (validation.error) {
      return validation.error
    }

    const { project } = validation
    return await operation(project, request, h)
  } catch (error) {
    const referenceNumber = request.params.referenceNumber
    // Use logName if provided, otherwise capitalize operationName
    const logMessage =
      logName || operationName.charAt(0).toUpperCase() + operationName.slice(1)
    logger.error({ err: error, referenceNumber }, `${logMessage} failed`)
    return buildValidationErrorResponse(h, HTTP_STATUS.INTERNAL_SERVER_ERROR, [
      {
        errorCode,
        message: `Failed to ${operationName}: ${error.message}`
      }
    ])
  }
}

/**
 * Generate presigned download URL with expiry
 */
export async function generateDownloadUrl(
  s3Bucket,
  s3Key,
  logger,
  filename = null
) {
  const s3Service = getS3Service(logger)
  const downloadUrl = await s3Service.getPresignedDownloadUrl(
    s3Bucket,
    s3Key,
    DOWNLOAD_URL_EXPIRES_IN,
    filename
  )
  return {
    downloadUrl,
    downloadExpiry: new Date(Date.now() + DOWNLOAD_URL_EXPIRES_IN * 1000)
  }
}

/**
 * Update project with benefit area file metadata
 */
export async function updateBenefitAreaFile(
  prisma,
  referenceNumber,
  fileMetadata
) {
  return prisma.pafs_core_projects.update({
    where: {
      reference_number_version: {
        reference_number: referenceNumber,
        version: 1
      }
    },
    data: {
      benefit_area_file_name: fileMetadata.filename,
      benefit_area_file_size: fileMetadata.fileSize,
      benefit_area_content_type: fileMetadata.contentType,
      benefit_area_file_s3_bucket: fileMetadata.s3Bucket,
      benefit_area_file_s3_key: fileMetadata.s3Key,
      benefit_area_file_download_url: fileMetadata.downloadUrl,
      benefit_area_file_download_expiry: fileMetadata.downloadExpiry,
      benefit_area_file_updated_at: new Date(),
      updated_at: new Date()
    }
  })
}

/**
 * Clear all benefit area file metadata
 */
export async function clearBenefitAreaFile(prisma, referenceNumber) {
  return prisma.pafs_core_projects.update({
    where: {
      reference_number_version: {
        reference_number: referenceNumber,
        version: 1
      }
    },
    data: {
      benefit_area_file_name: null,
      benefit_area_file_size: null,
      benefit_area_content_type: null,
      benefit_area_file_s3_bucket: null,
      benefit_area_file_s3_key: null,
      benefit_area_file_download_url: null,
      benefit_area_file_download_expiry: null,
      benefit_area_file_updated_at: null,
      updated_at: new Date()
    }
  })
}

/**
 * Delete file from S3
 */
export async function deleteFromS3(s3Bucket, s3Key, logger) {
  const s3Service = getS3Service(logger)
  return s3Service.deleteObject(s3Bucket, s3Key)
}
