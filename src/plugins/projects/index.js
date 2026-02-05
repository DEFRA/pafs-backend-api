import checkProjectName from './check-project-name/check-project-name.js'
import getProject from './get-project/get-project.js'
import upsertProject from './upsert-project/upsert-project.js'
import downloadBenefitAreaFile from './download-benefit-area-file/download-benefit-area-file.js'
import deleteBenefitAreaFile from './delete-benefit-area-file/delete-benefit-area-file.js'

const projectsPlugin = {
  name: 'projects',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([
      checkProjectName,
      getProject,
      upsertProject,
      downloadBenefitAreaFile,
      deleteBenefitAreaFile
    ])
    server.logger.info('Projects plugin registered')
  }
}

export default projectsPlugin
export { default as checkProjectName } from './check-project-name/check-project-name.js'
export { default as getProject } from './get-project/get-project.js'
export { default as upsertProject } from './upsert-project/upsert-project.js'
export { default as downloadBenefitAreaFile } from './download-benefit-area-file/download-benefit-area-file.js'
export { default as deleteBenefitAreaFile } from './delete-benefit-area-file/delete-benefit-area-file.js'
