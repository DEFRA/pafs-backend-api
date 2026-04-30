import { config } from '../../../config.js'

const HTTP_OK = 200

export const SUBMISSION_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed'
}

/**
 * ExternalSubmissionService
 *
 * Sends a prepared proposal payload to the external AIMS PD / Pipeline REST
 * API and records the outcome in `pafs_proposal_submissions`.
 *
 * The service is intentionally stateless — each call is independent so that
 * the admin resend path can use the same code as the initial submission.
 */
export class ExternalSubmissionService {
  constructor(prisma, logger) {
    this.prisma = prisma
    this.logger = logger
    this.enabled = config.get('externalSubmission.enabled')
    this.baseUrl = config.get('externalSubmission.baseUrl')
    this.endpoint = config.get('externalSubmission.endpoint')
    this.accessCode = config.get('externalSubmission.accessCode')
    this.timeout = config.get('externalSubmission.timeout')
  }

  /**
   * Send the proposal payload to the external system.
   *
   * Always records an attempt row in pafs_proposal_submissions regardless of
   * outcome so the admin panel can show the history.
   *
   * @param {Object} options
   * @param {bigint|number} options.projectId - DB project id
   * @param {string} options.referenceNumber - Project reference number
   * @param {Object} options.payload - Built proposal payload object
   * @param {boolean} [options.isResend=false] - true for admin-triggered resends
   * @returns {Promise<{success: boolean, httpStatus?: number, error?: string}>}
   */
  async send({ projectId, referenceNumber, payload, isResend = false }) {
    if (!this.enabled) {
      this.logger.warn(
        { referenceNumber },
        'External submission disabled — skipping send'
      )
      await this._recordAttempt({
        projectId,
        referenceNumber,
        status: SUBMISSION_STATUS.FAILED,
        httpStatusCode: null,
        errorMessage: 'External submission is disabled',
        responseBody: null,
        isResend
      })
      return { success: false, error: 'External submission is disabled' }
    }

    let httpStatus = null
    let responseText = null

    try {
      ;({ httpStatus, responseText } = await this._executeRequest(
        payload,
        referenceNumber
      ))

      if (httpStatus !== HTTP_OK) {
        return await this._handleFailure({
          projectId,
          referenceNumber,
          httpStatus,
          responseText,
          isResend
        })
      }

      return await this._handleSuccess({
        projectId,
        referenceNumber,
        httpStatus,
        responseText,
        isResend
      })
    } catch (error) {
      const errorMessage =
        error.name === 'AbortError'
          ? `Request timed out after ${this.timeout}ms`
          : error.message

      this.logger.error(
        { referenceNumber, error: errorMessage },
        'External submission request failed'
      )
      await this._recordAttempt({
        projectId,
        referenceNumber,
        status: SUBMISSION_STATUS.FAILED,
        httpStatusCode: httpStatus,
        errorMessage,
        responseBody: responseText,
        isResend
      })
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Execute the HTTP POST request with a timeout.
   * Returns the HTTP status code and response body text.
   * @private
   */
  async _executeRequest(payload, referenceNumber) {
    const url = new URL(`${this.baseUrl}${this.endpoint}`)
    url.searchParams.set('code', this.accessCode)

    this.logger.info(
      { referenceNumber, url: `${this.baseUrl}${this.endpoint}` },
      'Sending proposal to external system'
    )

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)

    let response
    try {
      response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      })
    } finally {
      clearTimeout(timer)
    }

    const responseText = await response.text().catch(() => null)
    return { httpStatus: response.status, responseText }
  }

  /**
   * Handle a non-OK HTTP response — record failure and return result.
   * @private
   */
  async _handleFailure({
    projectId,
    referenceNumber,
    httpStatus,
    responseText,
    isResend
  }) {
    this.logger.warn(
      { referenceNumber, httpStatus },
      'External submission returned non-OK HTTP status'
    )
    await this._recordAttempt({
      projectId,
      referenceNumber,
      status: SUBMISSION_STATUS.FAILED,
      httpStatusCode: httpStatus,
      errorMessage: `HTTP ${httpStatus}`,
      responseBody: responseText,
      isResend
    })
    return { success: false, httpStatus, error: `HTTP ${httpStatus}` }
  }

  /**
   * Handle a successful HTTP response — record success, stamp pol date, return result.
   * @private
   */
  async _handleSuccess({
    projectId,
    referenceNumber,
    httpStatus,
    responseText,
    isResend
  }) {
    this.logger.info(
      { referenceNumber, httpStatus },
      'Proposal sent to external system successfully'
    )
    await this._recordAttempt({
      projectId,
      referenceNumber,
      status: SUBMISSION_STATUS.SUCCESS,
      httpStatusCode: httpStatus,
      errorMessage: null,
      responseBody: responseText,
      isResend
    })
    await this._markSubmittedToPol(referenceNumber)
    return { success: true, httpStatus }
  }

  /**
   * Persist a submission attempt to pafs_proposal_submissions.
   * @private
   */
  async _recordAttempt({
    projectId,
    referenceNumber,
    status,
    httpStatusCode,
    errorMessage,
    responseBody,
    isResend
  }) {
    try {
      await this.prisma.pafs_proposal_submissions.create({
        data: {
          project_id: BigInt(projectId),
          reference_number: referenceNumber,
          status,
          http_status_code: httpStatusCode,
          error_message: errorMessage,
          response_body: responseBody,
          is_resend: isResend,
          attempted_at: new Date(),
          created_at: new Date()
        }
      })
    } catch (dbError) {
      // Recording failure must not block the caller — log and continue.
      this.logger.error(
        { referenceNumber, error: dbError.message },
        'Failed to record submission attempt in database'
      )
    }
  }

  /**
   * Update submitted_to_pol timestamp on the project record.
   * @private
   */
  async _markSubmittedToPol(referenceNumber) {
    try {
      await this.prisma.pafs_core_projects.updateMany({
        where: { reference_number: referenceNumber },
        data: { submitted_to_pol: new Date() }
      })
    } catch (dbError) {
      this.logger.error(
        { referenceNumber, error: dbError.message },
        'Failed to update submitted_to_pol on project'
      )
    }
  }
}
