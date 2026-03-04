import {
  UPLOAD_STATUS,
  FILE_STATUS
} from '../../../common/constants/file-upload.js'

/**
 * Scheduled Task: Cleanup Incomplete Uploads
 * Runs daily at 6:00 AM to delete file_uploads rows
 * where upload_status is not 'ready' and file_status is not 'complete'
 */

export default {
  name: 'cleanup-incomplete-uploads',
  schedule: '0 3 * * *', // Every day at 03:00
  runInWorker: false, // Run in main thread since it needs database access

  async handler(context) {
    const { logger, prisma } = context

    logger.info('Running cleanup-incomplete-uploads task')

    try {
      const result = await prisma.file_uploads.deleteMany({
        where: {
          AND: [
            { upload_status: { not: UPLOAD_STATUS.READY } },
            {
              OR: [
                { file_status: { not: FILE_STATUS.COMPLETE } },
                { file_status: null }
              ]
            }
          ]
        }
      })

      logger.info(
        { deletedCount: result.count },
        'Cleaned up incomplete file uploads'
      )

      return { success: true, deletedCount: result.count }
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup incomplete file uploads')
      throw error
    }
  }
}
