import Joi from 'joi'
import { FILE_UPLOAD_VALIDATION_CODES } from '../../../common/constants/index.js'
import {
  generateDownloadUrl,
  updateBenefitAreaFile,
  withBenefitAreaFileValidation
} from '../helpers/benefit-area-file-helper.js'
import { buildSuccessResponse } from '../../../common/helpers/response-builder.js'

/**
 * Download benefit area file - regenerates presigned URL
 */
export default {
  method: 'GET',
  path: '/api/v1/project/{referenceNumber}/benefit-area-file/download',
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
    return withBenefitAreaFileValidation(
      request,
      h,
      async (project, req) => {
        const { logger, prisma } = req.server

        const { downloadUrl, downloadExpiry } = await generateDownloadUrl(
          project.benefit_area_file_s3_bucket,
          project.benefit_area_file_s3_key,
          logger,
          project.benefit_area_file_name
        )

        await updateBenefitAreaFile(prisma, project.reference_number, {
          filename: project.benefit_area_file_name,
          fileSize: project.benefit_area_file_size,
          contentType: project.benefit_area_content_type,
          s3Bucket: project.benefit_area_file_s3_bucket,
          s3Key: project.benefit_area_file_s3_key,
          downloadUrl,
          downloadExpiry
        })

        logger.info(
          { referenceNumber: project.reference_number },
          'Download URL generated'
        )

        return buildSuccessResponse(h, {
          success: true,
          data: {
            downloadUrl,
            expiresAt: downloadExpiry,
            filename: project.benefit_area_file_name,
            fileSize: project.benefit_area_file_size,
            contentType: project.benefit_area_content_type
          }
        })
      },
      FILE_UPLOAD_VALIDATION_CODES.FILE_DOWNLOAD_FAILED,
      'generate download URL',
      'Download'
    )
  }
}
