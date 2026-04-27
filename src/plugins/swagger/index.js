import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Inert from '@hapi/inert'
import Vision from '@hapi/vision'
import HapiSwagger from 'hapi-swagger'
import { config } from '../../config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * hapi-swagger options.
 *
 * hapi-swagger reads each registered route's `tags`, `description`, `notes`,
 * and Joi `validate` schemas to auto-generate the OpenAPI spec. Routes must
 * include the 'api' tag to be included.
 *
 * See: https://github.com/hapi-swagger/hapi-swagger
 */
const hapiSwaggerOptions = {
  info: {
    title: 'PAFS Backend API',
    description:
      '## Project Application and Funding Service - Backend API\n\n' +
      'RESTful API for managing Flood and Coastal Erosion Risk Management (FCRM) ' +
      'projects on behalf of Regional Management Authorities (RMAs) and the Environment Agency.\n\n' +
      '---\n\n' +
      '### Authentication\n\n' +
      '| Mechanism | Header | Format | Routes |\n' +
      '|---|---|---|---|\n' +
      '| **JWT Bearer** | `Authorization` | `Bearer <accessToken>` | All authenticated internal routes |\n' +
      '| **Cognito Bearer** | `Authorization` | `Bearer <cognitoToken>` | External API routes (gateway only) |\n\n' +
      'Obtain a JWT access token via `POST /api/v1/auth/login`. ' +
      'Refresh via `POST /api/v1/auth/refresh`.\n\n' +
      'Cognito tokens are obtained via the CDP public API Gateway Cognito endpoint ' +
      '(`POST https://<service>-<suffix>.auth.eu-west-2.amazoncognito.com/oauth2/token`) ' +
      'using the `client_credentials` grant. Token validation is handled by the gateway — ' +
      'not by this service.\n\n' +
      '---\n\n' +
      '### External API Access\n\n' +
      'Routes under `/api/v1/external/` are accessible **only** via the CDP public API Gateway. ' +
      'Direct calls to the internal service URL are blocked by the gateway-guard middleware.\n\n' +
      '---\n\n' +
      '### Role-Based Access\n\n' +
      '- **Public** - No authentication required.\n' +
      '- **Authenticated** - Valid JWT Bearer token required.\n' +
      '- **Admin only** - Valid JWT from an account with `admin: true`\n' +
      '- **External (Gateway)** - Cognito client-credentials Bearer token, validated by CDP API Gateway',
    version: config.get('serviceVersion') ?? '1.0.0',
    contact: {
      name: 'Defra DDTS',
      url: 'https://www.gov.uk/government/organisations/department-for-environment-food-rural-affairs'
    },
    license: {
      name: 'Open Government Licence v3.0',
      url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'
    }
  },

  securityDefinitions: {
    jwt: {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header',
      description: 'JWT Bearer token. Format: `Bearer <accessToken>`'
    }
  },

  security: [{ jwt: [] }],

  tags: [
    {
      name: 'health',
      description:
        'Service health and readiness checks. Public — no auth required.'
    },
    {
      name: 'auth',
      description:
        'Authentication, session management, and password operations. ' +
        'Login, logout, token refresh, forgot/reset password, and invitation set-password flow.'
    },
    {
      name: 'accounts',
      description:
        'User account creation, retrieval, update, and administration. ' +
        'Includes account approval, reactivation, and invitation management.'
    },
    {
      name: 'areas',
      description:
        'Geographic area management: EA Areas, PSO Areas, RMAs, and Authorities. ' +
        '`GET /areas-by-type` is public; all other endpoints require JWT.'
    },
    {
      name: 'projects',
      description:
        'FCRM project proposal management: create, retrieve, update status, ' +
        'validate names, and manage benefit area shapefiles. ' +
        'All endpoints require JWT (update-status also accepts API Key).'
    },
    {
      name: 'file-uploads',
      description:
        'File upload session management via CDP Uploader for benefit area shapefiles. JWT is optional.'
    },
    {
      name: 'email',
      description: 'Email address validation utilities. Public endpoint.'
    },
    {
      name: 'downloads',
      description:
        'FCERM1 Excel spreadsheet generation and download endpoints. All endpoints require JWT.'
    },
    {
      name: 'external',
      description:
        'Public API endpoints accessible via the CDP public API Gateway only. ' +
        'Authentication is handled by the gateway using AWS Cognito client-credentials. ' +
        'All routes under /api/v1/external/ are blocked if accessed directly.'
    },
    {
      name: 'scheduler',
      description:
        'Distributed scheduler task management. All endpoints require JWT with `admin: true`.'
    }
  ],

  grouping: 'tags',
  sortTags: 'alpha',
  sortEndpoints: 'alpha',
  documentationPage: true,
  swaggerUI: true,
  jsonPath: '/swagger.json',
  documentationPath: '/documentation',
  swaggerUIPath: '/swaggerui/',
  schemes: ['https', 'http'],
  basePath: '/'
}

const swaggerPlugin = {
  name: 'swagger',
  version: '1.0.0',
  register: async (server) => {
    const enabled = config.get('swagger.enabled')

    if (!enabled) {
      server.logger.info('Swagger documentation is disabled')
      return
    }

    const staticSpec = JSON.parse(
      readFileSync(join(__dirname, 'openapi.json'), 'utf8')
    )

    await server.register([
      Inert,
      Vision,
      {
        plugin: HapiSwagger,
        options: {
          ...hapiSwaggerOptions,
          auth: false
        }
      }
    ])

    server.route({
      method: 'GET',
      path: '/openapi.json',
      options: {
        auth: false,
        description: 'Handcrafted OpenAPI 3.0 reference specification',
        tags: ['api', 'documentation']
      },
      handler: (_request, h) =>
        h.response(staticSpec).type('application/json; charset=utf-8')
    })

    server.logger.info(
      'Swagger documentation registered at /documentation. Static OpenAPI 3.0 spec available at /openapi.json'
    )
  }
}

export default swaggerPlugin
