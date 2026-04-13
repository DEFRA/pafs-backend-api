import Joi from 'joi'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES,
  DOWNLOAD_URL_EXPIRES_IN
} from '../../../common/constants/index.js'
import {
  buildValidationErrorResponse,
  buildSuccessResponse
} from '../../../common/helpers/response-builder.js'
import { validateProjectWithFundingCalculator } from '../helpers/funding-calculator-validation-helper.js'
import { buildLegacyS3Key } from '../helpers/legacy-file-resolver.js'
import { generateDownloadUrl } from '../helpers/benefit-area-file-helper.js'
import { config } from '../../../config.js'

/**
 * Download funding calculator - generates a presigned URL on every request.
 * No DB write: the S3 key is derived deterministically from the project slug + version.
 */
export default {
  method: 'GET',
  path: '/api/v1/project/{referenceNumber}/funding-calculator/download',
  options: {
    auth: 'jwt',
    description: 'Download funding calculator file',
    notes:
      'Generates a presigned download URL for legacy funding calculator files. No data is persisted.',
    tags: ['api', 'projects', 'files'],
    validate: {
      params: Joi.object({
        referenceNumber: Joi.string().required()
      })
    }
  },
  handler: async (request, h) => {
    const { logger } = request.server

    try {
      const validation = await validateProjectWithFundingCalculator(request, h)
      if (validation.error) {
        return validation.error
      }

      const { project, referenceNumber } = validation

      const s3Bucket = config.get('cdpUploader.s3Bucket')
      const s3Key = buildLegacyS3Key(
        project.slug,
        project.version,
        project.funding_calculator_file_name
      )

      logger.info(
        { referenceNumber, s3Bucket, s3Key },
        'Generating funding calculator presigned URL'
      )

      const { downloadUrl } = await generateDownloadUrl(
        s3Bucket,
        s3Key,
        logger,
        project.funding_calculator_file_name
      )

      logger.info(
        { referenceNumber },
        'Funding calculator download URL generated'
      )

      return buildSuccessResponse(h, {
        success: true,
        data: {
          downloadUrl,
          expiresIn: DOWNLOAD_URL_EXPIRES_IN,
          filename: project.funding_calculator_file_name,
          fileSize: project.funding_calculator_file_size,
          contentType: project.funding_calculator_content_type
        }
      })
    } catch (error) {
      const referenceNumber = request.params.referenceNumber
      logger.error(
        { err: error, referenceNumber },
        'Failed to generate funding calculator download URL'
      )
      return buildValidationErrorResponse(
        h,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_DOWNLOAD_FAILED,
            message: `Failed to generate download URL: ${error.message}`
          }
        ]
      )
    }
  }
}
