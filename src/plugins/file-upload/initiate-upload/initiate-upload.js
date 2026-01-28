import Joi from 'joi'
import { getCdpUploaderService } from '../../../common/services/file-upload/cdp-uploader-service.js'
import { config } from '../../../config.js'
import { HTTP_STATUS, UPLOAD_STATUS } from '../../../common/constants/index.js'

const frontendUrl = config.get('frontendUrl')

const initiateUploadSchema = {
  payload: Joi.object({
    redirect: Joi.string().optional().description('Redirect URL after upload'),
    entityType: Joi.string()
      .optional()
      .description('Type of entity (e.g., proposal, user)'),
    entityId: Joi.number().integer().optional().description('ID of the entity'),
    reference: Joi.string().optional().description('Business reference'),
    metadata: Joi.object().optional().description('Custom metadata'),
    downloadUrls: Joi.array()
      .items(Joi.string().uri())
      .optional()
      .description('URLs for CDP Uploader to download files from')
  })
}

const initiateUpload = {
  method: 'POST',
  path: '/api/v1/file-uploads/initiate',
  options: {
    auth: {
      strategy: 'jwt',
      mode: 'optional'
    },
    validate: initiateUploadSchema,
    description: 'Initiate a file upload session',
    notes: 'Creates a new upload session with CDP Uploader',
    tags: ['api', 'file-uploads']
  },
  handler: async (request, h) => {
    const { logger } = request.server
    const cdpUploader = getCdpUploaderService(logger)

    const {
      redirect,
      entityType,
      entityId,
      reference,
      metadata = {},
      downloadUrls
    } = request.payload

    try {
      // Build callback URL for CDP Uploader to notify us when upload is complete
      const callbackUrl = `${request.server.info.uri}/api/v1/file-uploads/callback`

      // Prepare metadata to send to CDP Uploader
      const uploadMetadata = {
        reference,
        entityType,
        entityId,
        userId: request.auth?.credentials?.user?.id,
        ...metadata
      }

      // Initiate upload with CDP Uploader
      const uploadSession = await cdpUploader.initiate({
        redirect: redirect || '/upload-complete',
        callback: callbackUrl,
        metadata: uploadMetadata,
        downloadUrls
      })

      // Store upload record in database
      await request.prisma.file_uploads.create({
        data: {
          uploadId: uploadSession.uploadId,
          uploadStatus: downloadUrls
            ? UPLOAD_STATUS.PROCESSING
            : UPLOAD_STATUS.PENDING,
          entityType,
          entityId,
          reference,
          metadata: uploadMetadata,
          uploadedByUserId: request.auth?.credentials?.user?.id
        }
      })

      logger.info(
        {
          uploadId: uploadSession.uploadId,
          reference
        },
        'File upload initiated'
      )

      // Return upload URL and status URL to client
      return h
        .response({
          success: true,
          data: {
            uploadId: uploadSession.uploadId,
            uploadUrl: cdpUploader.buildUploadUrl(
              uploadSession.uploadUrl,
              frontendUrl
            ),
            statusUrl: `${request.server.info.uri}/api/v1/file-uploads/${uploadSession.uploadId}/status`,
            reference
          }
        })
        .code(HTTP_STATUS.CREATED)
    } catch (error) {
      logger.error(
        {
          err: error
        },
        'Failed to initiate upload'
      )

      return h
        .response({
          success: false,
          message: 'Failed to initiate file upload',
          error: error.message
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }
  }
}

export default initiateUpload
