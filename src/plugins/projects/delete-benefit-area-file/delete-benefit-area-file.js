import Joi from 'joi'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import {
  getProjectByReference,
  deleteFromS3,
  clearBenefitAreaFile
} from '../helpers/benefit-area-file-helper.js'

/**
 * Delete benefit area file - removes from S3 and clears metadata
 */
export default {
  method: 'DELETE',
  path: '/api/v1/projects/{referenceNumber}/benefit-area-file',
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
    const { referenceNumber } = request.params

    try {
      const project = await getProjectByReference(prisma, referenceNumber)

      if (!project) {
        return h
          .response({
            validationErrors: [
              {
                errorCode: FILE_UPLOAD_VALIDATION_CODES.PROJECT_NOT_FOUND,
                message: `Project ${referenceNumber} not found`
              }
            ]
          })
          .code(HTTP_STATUS.NOT_FOUND)
      }

      if (
        !project.benefit_area_file_s3_bucket ||
        !project.benefit_area_file_s3_key
      ) {
        return h
          .response({
            validationErrors: [
              {
                errorCode:
                  FILE_UPLOAD_VALIDATION_CODES.BENEFIT_AREA_FILE_NOT_FOUND,
                message: 'No benefit area file found for this project'
              }
            ]
          })
          .code(HTTP_STATUS.NOT_FOUND)
      }

      await deleteFromS3(
        project.benefit_area_file_s3_bucket,
        project.benefit_area_file_s3_key,
        logger
      )

      await clearBenefitAreaFile(prisma, referenceNumber)

      logger.info({ referenceNumber }, 'File deleted successfully')

      return h.response({
        success: true,
        message: 'Benefit area file deleted successfully'
      })
    } catch (error) {
      logger.error({ err: error, referenceNumber }, 'Delete failed')
      return h
        .response({
          validationErrors: [
            {
              errorCode:
                FILE_UPLOAD_VALIDATION_CODES.BENEFIT_AREA_DELETE_FAILED,
              message: `Failed to delete file: ${error.message}`
            }
          ]
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}
