import { isProduction } from './environment.js'

const awsSchema = {
  cdpUploader: {
    enabled: {
      doc: 'Enable CDP Uploader integration',
      format: Boolean,
      default: true,
      env: 'CDP_UPLOADER_ENABLED'
    },
    baseUrl: {
      doc: 'CDP Uploader base URL (http://localhost:7337 for local development)',
      format: 'url',
      default: isProduction
        ? 'https://cdp-uploader.prod.cdp-int.defra.cloud'
        : 'http://localhost:7337',
      env: 'CDP_UPLOADER_BASE_URL'
    },
    s3Bucket: {
      doc: 'S3 bucket name for file uploads',
      format: String,
      default: 'pafs-uploads',
      env: 'CDP_UPLOADER_S3_BUCKET'
    },
    s3Path: {
      doc: 'S3 path (folder) for organizing uploaded files within the bucket',
      format: String,
      default: '',
      env: 'CDP_UPLOADER_S3_PATH'
    },
    s3Endpoint: {
      doc: 'S3 endpoint URL for AWS SDK (http://localhost:4566 for localstack)',
      format: String,
      nullable: true,
      default: isProduction ? null : 'http://localhost:4566',
      env: 'CDP_UPLOADER_S3_ENDPOINT'
    },
    maxFileSize: {
      doc: 'Maximum file size in bytes',
      format: 'nat',
      default: 20000000, // 20MB
      env: 'CDP_UPLOADER_MAX_FILE_SIZE'
    },
    allowedMimeTypes: {
      doc: 'Comma-separated list of allowed MIME types',
      format: String,
      default:
        'application/zip,application/x-zip-compressed,application/octet-stream',
      env: 'CDP_UPLOADER_ALLOWED_MIME_TYPES'
    },
    allowedZipExtensions: {
      doc: 'Comma-separated list of allowed file extensions inside ZIP files',
      format: String,
      default: '.dbf,.shx,.shp,.prj',
      env: 'CDP_UPLOADER_ALLOWED_ZIP_EXTENSIONS'
    },
    timeout: {
      doc: 'CDP Uploader request timeout in milliseconds',
      format: 'nat',
      default: 30000,
      env: 'CDP_UPLOADER_TIMEOUT'
    }
  },
  sqsEndpoint: {
    doc: 'SQS endpoint URL (http://localhost:4566 for LocalStack local development)',
    format: String,
    nullable: true,
    default: isProduction ? null : 'http://localhost:4566',
    env: 'SQS_ENDPOINT'
  },
  sqsProgrammeGeneration: {
    queueUrl: {
      doc: 'SQS queue URL for programme generation jobs',
      format: String,
      default: 'http://localhost:4566/000000000000/pafs_programme_generation',
      env: 'SQS_PROGRAMME_GENERATION_QUEUE_URL'
    },
    visibilityTimeout: {
      doc: 'Visibility timeout in seconds — must cover worst-case generation time',
      format: Number,
      default: 900,
      env: 'SQS_PROGRAMME_GENERATION_VISIBILITY_TIMEOUT'
    },
    waitTimeSeconds: {
      doc: 'SQS long-poll wait time in seconds (max 20)',
      format: Number,
      default: 20,
      env: 'SQS_PROGRAMME_GENERATION_WAIT_TIME_SECONDS'
    }
  }
}

export { awsSchema }
