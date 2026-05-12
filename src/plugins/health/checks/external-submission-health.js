import { config } from '../../../config.js'

/**
 * Check external submission integration is correctly configured.
 * Intentionally lightweight — validates config presence only, no HTTP call.
 *
 * Note: the accessCode is an opaque token that expires every ~90 days. Because
 * the external service exposes no safe read endpoint and no expiry is embedded
 * in the token itself, programmatic verification is not possible here.
 * Token validity is confirmed only at submission time (POST). Rotate the token
 * on a recurring 85-day calendar reminder and restart the service after rotation.
 *
 * @returns {{healthy: boolean, status: string, message?: string, error?: string}}
 */
export function checkExternalSubmissionHealth() {
  const enabled = config.get('externalSubmission.enabled')

  if (!enabled) {
    return {
      status: 'disabled',
      healthy: true,
      message: 'External submission is disabled'
    }
  }

  const baseUrl = config.get('externalSubmission.baseUrl')
  const accessCode = config.get('externalSubmission.accessCode')

  if (!baseUrl || !accessCode) {
    return {
      status: 'misconfigured',
      healthy: false,
      error:
        'External submission is enabled but baseUrl or accessCode is not set'
    }
  }

  return { status: 'configured', healthy: true }
}
