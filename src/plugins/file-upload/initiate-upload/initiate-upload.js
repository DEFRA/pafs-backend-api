import Joi from 'joi'
import { getCdpUploaderService } from '../../../common/services/file-upload/cdp-uploader-service.js'
import { HTTP_STATUS, UPLOAD_STATUS } from '../../../common/constants/index.js'

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

/**
 * Build upload metadata object
 * @private
 */
function buildUploadMetadata(payload, userId) {
  const { reference, entityType, entityId, metadata = {} } = payload
  return {
    reference,
    entityType,
    entityId,
    userId,
    ...metadata
  }
}

/**
 * Determine upload status based on whether downloadUrls are provided
 * @private
 */
function getInitialUploadStatus(downloadUrls) {
  return downloadUrls ? UPLOAD_STATUS.PROCESSING : UPLOAD_STATUS.PENDING
}

/**
 * Create upload record in database
 * @private
 */
async function createUploadRecord(
  prisma,
  uploadSession,
  payload,
  uploadMetadata,
  userId
) {
  const { entityType, entityId, reference, downloadUrls } = payload

  return prisma.file_uploads.create({
    data: {
      upload_id: uploadSession.uploadId,
      upload_status: getInitialUploadStatus(downloadUrls),
      entity_type: entityType,
      entity_id: entityId,
      reference,
      metadata: uploadMetadata,
      uploaded_by_user_id: userId
    }
  })
}

/**
 * Build success response
 * @private
 */
function buildSuccessResponse(
  h,
  uploadSession,
  cdpUploader,
  serverUri,
  reference
) {
  return h
    .response({
      success: true,
      data: {
        ...uploadSession,
        reference
      }
    })
    .code(HTTP_STATUS.CREATED)
}

/**
 * Build error response
 * @private
 */
function buildErrorResponse(h) {
  return h
    .response({
      success: false,
      message: 'Failed to initiate file upload',
      error: 'Upload initiation failed'
    })
    .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
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
    const { payload, prisma, server } = request
    const userId = request.auth?.credentials?.userId
    const cdpUploader = getCdpUploaderService(logger)

    try {
      // Prepare metadata to send to CDP Uploader
      const uploadMetadata = buildUploadMetadata(payload, userId)

      // Initiate upload with CDP Uploader (no callback - using status polling instead)
      const uploadSession = await cdpUploader.initiate({
        redirect: payload.redirect || '/upload-complete',
        metadata: uploadMetadata,
        downloadUrls: payload.downloadUrls
      })

      // Store upload record in database
      await createUploadRecord(
        prisma,
        uploadSession,
        payload,
        uploadMetadata,
        userId
      )

      logger.info(
        {
          uploadId: uploadSession.uploadId,
          reference: payload.reference
        },
        'File upload initiated'
      )

      // Return upload URL and status URL to client
      return buildSuccessResponse(
        h,
        uploadSession,
        cdpUploader,
        server.info.uri,
        payload.reference
      )
    } catch (error) {
      logger.error(
        {
          err: error
        },
        'Failed to initiate upload'
      )

      return buildErrorResponse(h)
    }
  }
}

export default initiateUpload
