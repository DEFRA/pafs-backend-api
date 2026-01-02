import { HTTP_STATUS } from '../../../common/constants/index.js'

const validateSession = {
  method: 'GET',
  path: '/api/v1/auth/validate-session',
  options: {
    auth: 'jwt',
    description: 'Validate current session',
    notes:
      'Lightweight endpoint to check if JWT token and session are still valid',
    tags: ['api', 'auth']
  },
  handler: async (_request, h) => {
    return h.response({ valid: true }).code(HTTP_STATUS.OK)
  }
}

export default validateSession
