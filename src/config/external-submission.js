export const externalSubmissionSchema = {
  externalSubmission: {
    enabled: {
      doc: 'Enable external (AIMS PD / Pipeline) submission integration',
      format: Boolean,
      default: false,
      env: 'EXTERNAL_SUBMISSION_ENABLED'
    },
    baseUrl: {
      doc: 'Base URL of the external AIMS PD / Pipeline REST API',
      format: '*',
      default: null,
      env: 'EXTERNAL_SUBMISSION_BASE_URL'
    },
    endpoint: {
      doc: 'Route path for submitting a proposal (appended to baseUrl)',
      format: String,
      default: '/api/UpsertPipelineItem',
      env: 'EXTERNAL_SUBMISSION_ENDPOINT'
    },
    accessCode: {
      doc: 'API access code / key sent as the Authorization Bearer token',
      format: String,
      default: '',
      env: 'EXTERNAL_SUBMISSION_ACCESS_CODE',
      sensitive: true
    },
    timeout: {
      doc: 'HTTP request timeout in milliseconds',
      format: 'nat',
      default: 30000,
      env: 'EXTERNAL_SUBMISSION_TIMEOUT'
    }
  }
}
