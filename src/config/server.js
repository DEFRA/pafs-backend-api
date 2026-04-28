import { isProduction } from './environment.js'

const serverSchema = {
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind',
    format: 'port',
    default: 3001,
    env: 'PORT'
  },
  serviceName: {
    doc: 'Api Service Name',
    format: String,
    default: 'pafs-backend-api'
  },
  cdpEnvironment: {
    doc: 'The CDP environment the app is running in. With the addition of "local" for local development',
    format: [
      'local',
      'infra-dev',
      'management',
      'dev',
      'test',
      'perf-test',
      'ext-test',
      'prod'
    ],
    default: 'local',
    env: 'ENVIRONMENT'
  },
  awsRegion: {
    doc: 'AWS region for RDS and other AWS services',
    format: String,
    default: 'eu-west-2',
    env: 'AWS_REGION'
  },
  frontendUrl: {
    doc: 'Frontend application URL for password reset links',
    format: 'url',
    default: 'http://localhost:3000',
    env: 'FRONTEND_URL'
  },
  httpProxy: {
    doc: 'HTTP Proxy URL',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isMetricsEnabled: {
    doc: 'Enable metrics reporting',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_METRICS'
  },
  tracing: {
    header: {
      doc: 'CDP tracing header name',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  gateway: {
    identityHeader: {
      doc: 'HTTP header injected by the CDP public API Gateway to identify gateway traffic. Set via requestParameters in the API Gateway OpenAPI spec.',
      format: String,
      default: 'x-cdp-from-gateway',
      env: 'GATEWAY_IDENTITY_HEADER'
    }
  },
  swagger: {
    enabled: {
      doc: 'Enable Swagger API documentation UI and JSON spec endpoint',
      format: Boolean,
      default: !isProduction,
      env: 'SWAGGER_ENABLED'
    }
  }
}

export { serverSchema }
