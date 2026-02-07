import Joi from 'joi'
import { FILE_UPLOAD_VALIDATION_CODES } from '../../../common/constants/index.js'
import {
  deleteFromS3,
  clearBenefitAreaFile,
  withBenefitAreaFileValidation
} from '../helpers/benefit-area-file-helper.js'
import { buildSuccessResponse } from '../../../common/helpers/response-builder.js'

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
    return withBenefitAreaFileValidation(
      request,
      h,
      async (project, req) => {
        const { logger, prisma } = req.server

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
      },
      FILE_UPLOAD_VALIDATION_CODES.FILE_DELETE_FAILED,
      'delete file',
      'Delete'
    )
  }
}
