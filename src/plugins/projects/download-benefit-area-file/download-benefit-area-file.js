import Joi from 'joi'
import {
  HTTP_STATUS,
  FILE_UPLOAD_VALIDATION_CODES
} from '../../../common/constants/index.js'
import {
  getProjectByReference,
  generateDownloadUrl,
  updateBenefitAreaFile
} from '../helpers/benefit-area-file-helper.js'

/**
 * Download benefit area file - regenerates presigned URL
 */
export default {
  method: 'GET',
  path: '/api/v1/projects/{referenceNumber}/benefit-area-file/download',
  options: {
    auth: 'jwt',
    description: 'Download benefit area file',
    notes: 'Generates a new presigned download URL (7 days validity)',
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

      const { downloadUrl, downloadExpiry } = await generateDownloadUrl(
        project.benefit_area_file_s3_bucket,
        project.benefit_area_file_s3_key,
        logger
      )

      await updateBenefitAreaFile(prisma, referenceNumber, {
        filename: project.benefit_area_file_name,
        fileSize: project.benefit_area_file_size,
        contentType: project.benefit_area_content_type,
        s3Bucket: project.benefit_area_file_s3_bucket,
        s3Key: project.benefit_area_file_s3_key,
        downloadUrl,
        downloadExpiry
      })

      logger.info({ referenceNumber }, 'Download URL generated')

      return h.response({
        success: true,
        data: {
          downloadUrl,
          expiresAt: downloadExpiry,
          filename: project.benefit_area_file_name,
          fileSize: project.benefit_area_file_size,
          contentType: project.benefit_area_content_type
        }
      })
    } catch (error) {
      logger.error({ err: error, referenceNumber }, 'Download failed')
      return h
        .response({
          validationErrors: [
            {
              errorCode:
                FILE_UPLOAD_VALIDATION_CODES.BENEFIT_AREA_DOWNLOAD_FAILED,
              message: `Failed to generate download URL: ${error.message}`
            }
          ]
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}
