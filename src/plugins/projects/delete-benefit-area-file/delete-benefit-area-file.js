import Joi from 'joi'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import {
  deleteFromS3,
  clearBenefitAreaFile
} from '../helpers/benefit-area-file-helper.js'
import { validateProjectWithBenefitAreaFile } from '../helpers/benefit-area-validation-helper.js'
import {
  buildValidationErrorResponse,
  buildSuccessResponse
} from '../../../common/helpers/response-builder.js'

/**
 * Delete benefit area file - removes from S3 and clears metadata
 */
export default {
  method: 'DELETE',
  path: '/api/v1/project/{referenceNumber}/benefit-area-file',
  options: {
    auth: 'jwt',
    description: 'Delete benefit area file',
    notes: 'Deletes file from S3 and clears project metadata',
    tags: ['api', 'projects', 'files'],
    validate: {
      params: Joi.object({
        referenceNumber: Joi.string().required()
      })
    }
  },
  handler: async (request, h) => {
    const { logger, prisma } = request.server

    try {
      const validation = await validateProjectWithBenefitAreaFile(request, h)
      if (validation.error) {
        return validation.error
      }

      const { project } = validation

      await deleteFromS3(
        project.benefit_area_file_s3_bucket,
        project.benefit_area_file_s3_key,
        logger
      )

      await clearBenefitAreaFile(prisma, project.reference_number)

      logger.info(
        { referenceNumber: project.reference_number },
        'File deleted successfully'
      )

      return buildSuccessResponse(h, {
        success: true,
        message: 'Benefit area file deleted successfully'
      })
    } catch (error) {
      // Extract referenceNumber safely for logging
      const referenceNumber = request.params.referenceNumber?.replaceAll(
        '-',
        '/'
      )
      logger.error({ err: error, referenceNumber }, 'Delete failed')
      return buildValidationErrorResponse(
        h,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        [
          {
            errorCode: FILE_UPLOAD_VALIDATION_CODES.FILE_DELETE_FAILED,
            message: `Failed to delete file: ${error.message}`
          }
        ]
      )
    }
  }
}
