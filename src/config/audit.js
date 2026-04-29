import { isProduction } from './environment.js'

const auditArchiveSchema = {
  auditArchive: {
    enabled: {
      doc: 'Enable audit log archival to S3. Defaults to true in production; set AUDIT_ARCHIVE_ENABLED=true to enable in UAT.',
      format: Boolean,
      default: isProduction,
      env: 'AUDIT_ARCHIVE_ENABLED'
    },
    retentionDays: {
      doc: 'Number of days to retain audit log records before they are eligible for archival',
      format: 'nat',
      default: 730, // 2 years
      env: 'AUDIT_ARCHIVE_RETENTION_DAYS'
    },
    maxRecords: {
      doc: 'Maximum number of records allowed in audit_log before archival is triggered regardless of age',
      format: 'nat',
      default: 1000000,
      env: 'AUDIT_ARCHIVE_MAX_RECORDS'
    },
    s3Bucket: {
      doc: 'S3 bucket to store archived audit log files',
      format: String,
      default: 'pafs-audit-archive',
      env: 'AUDIT_ARCHIVE_S3_BUCKET'
    },
    s3Prefix: {
      doc: 'S3 key prefix (folder) under which archived files are stored',
      format: String,
      default: 'audit-logs',
      env: 'AUDIT_ARCHIVE_S3_PREFIX'
    },
    batchSize: {
      doc: 'Number of audit_log rows fetched and uploaded per S3 object',
      format: 'nat',
      default: 10000,
      env: 'AUDIT_ARCHIVE_BATCH_SIZE'
    }
  }
}

export { auditArchiveSchema }
