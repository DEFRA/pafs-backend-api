import initiateUpload from './initiate-upload/initiate-upload.js'
import callback from './callback/callback.js'
import getUploadStatus from './get-upload-status/get-upload-status.js'
import downloadFile from './download-file/download-file.js'

const fileUploadPlugin = {
  name: 'file-upload',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([initiateUpload, callback, getUploadStatus, downloadFile])
    server.logger.info('File upload plugin registered')
  }
}

export default fileUploadPlugin
export { default as initiateUpload } from './initiate-upload/initiate-upload.js'
export { default as callback } from './callback/callback.js'
export { default as getUploadStatus } from './get-upload-status/get-upload-status.js'
export { default as downloadFile } from './download-file/download-file.js'
