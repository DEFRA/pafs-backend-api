import login from './login.js'
import logout from './logout.js'
import refresh from './refresh.js'
import validateToken from './validate-token.js'
import validateSession from './validate-session.js'

export const sessionRoutes = [
  login,
  logout,
  refresh,
  validateToken,
  validateSession
]
export default sessionRoutes
