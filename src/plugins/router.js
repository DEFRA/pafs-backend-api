import { health } from '../routes/health/index.js'
import authRoutes from '../routes/auth/index.js'

const router = {
  plugin: {
    name: 'router',
    register: (server, _options) => {
      server.route([health, ...authRoutes])
    }
  }
}

export { router }
