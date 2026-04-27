import {
  getProjectFcerm1Legacy,
  getProjectFcerm1New
} from './get-project-fcerm1/get-project-fcerm1.js'
import { getProgrammeStatus } from './programme/programme-status.js'
import { generateUserProgramme } from './programme/programme-generate.js'
import { getUserProgrammeFile } from './programme/programme-file.js'
import { getAdminProgrammeStatus } from './admin-programme/admin-programme-status.js'
import { generateAdminProgramme } from './admin-programme/admin-programme-generate.js'
import { getAdminProgrammeFile } from './admin-programme/admin-programme-file.js'

const downloadsPlugin = {
  name: 'downloads',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([
      // Individual project downloads
      getProjectFcerm1Legacy,
      getProjectFcerm1New,

      // User area programme downloads (user-scoped)
      getProgrammeStatus,
      generateUserProgramme,
      getUserProgrammeFile,

      // Admin system-wide programme downloads (shared)
      getAdminProgrammeStatus,
      generateAdminProgramme,
      getAdminProgrammeFile
    ])
    server.logger.info('Downloads plugin registered')
  }
}

export default downloadsPlugin
