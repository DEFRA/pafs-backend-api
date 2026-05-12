import Joi from 'joi'
import {
  FILE_UPLOAD_VALIDATION_CODES,
  HTTP_STATUS
} from '../../../common/constants/index.js'
import {
  generateDownloadUrl,
  withBenefitAreaFileValidation
} from '../helpers/benefit-area-file-helper.js'

/**
 * GET /api/v1/project/{referenceNumber}/benefit-area-file/download
 *
 * Generates a fresh presigned S3 URL for the project's benefit area shapefile ZIP.
 * Always regenerates — never uses the cached URL from the database.
 * This avoids the STS token expiry issue where cached URLs become invalid
 * when the ECS task role credentials rotate.
 */
const downloadBenefitAreaFile = {
  method: 'GET',
  path: '/api/v1/project/{referenceNumber}/benefit-area-file/download',
  options: {
    auth: 'jwt',
    description: 'Get presigned download URL for benefit area file',
    notes:
      'Generates a fresh presigned S3 URL on every request. The frontend uses this endpoint to redirect the user directly to S3.',
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
        const { logger } = req.server
        const filename =
          project.benefit_area_file_name ?? `${project.slug}_benefit_area.zip`

        const { downloadUrl } = await generateDownloadUrl(
          project.benefit_area_file_s3_bucket,
          project.benefit_area_file_s3_key,
          logger,
          filename
        )

        return h.response({ downloadUrl, filename }).code(HTTP_STATUS.OK)
      },
      FILE_UPLOAD_VALIDATION_CODES.FILE_DOWNLOAD_FAILED,
      'get download URL',
      'Download'
    )
  }
}

export default downloadBenefitAreaFile
