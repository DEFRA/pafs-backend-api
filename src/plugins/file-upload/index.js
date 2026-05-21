import initiateUpload from './initiate-upload/initiate-upload.js'
import getUploadStatus from './get-upload-status/get-upload-status.js'
import callbackUpload from './callback/callbackUpload.js'

const fileUploadPlugin = {
  name: 'file-upload',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([initiateUpload, getUploadStatus, callbackUpload])
    server.logger.info('File upload plugin registered')
  }
}

export default fileUploadPlugin
export { default as initiateUpload } from './initiate-upload/initiate-upload.js'
export { default as getUploadStatus } from './get-upload-status/get-upload-status.js'
export { default as callbackUpload } from './callback/callbackUpload.js'
