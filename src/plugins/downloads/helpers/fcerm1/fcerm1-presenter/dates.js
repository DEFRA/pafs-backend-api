import { PROJECT_TYPES } from '../../../../../common/constants/project.js'
import { formatDate } from '../fcerm1-presenter-utils.js'

const SIMPLIFIED_DATE_TYPES = new Set([PROJECT_TYPES.STU, PROJECT_TYPES.STR])

export const datesMixin = {
  earliestStartDate() {
    return formatDate(this._p, 'earliest_start_month', 'earliest_start_year')
  },
  earliestStartDateWithGiaAvailable() {
    return this._p.could_start_early
      ? formatDate(this._p, 'earliest_with_gia_month', 'earliest_with_gia_year')
      : null
  },
  startBusinessCaseDate() {
    return formatDate(
      this._p,
      'start_outline_business_case_month',
      'start_outline_business_case_year'
    )
  },
  completeBusinessCaseDate() {
    if (SIMPLIFIED_DATE_TYPES.has(this._p.project_type)) {
      return null
    }
    return formatDate(
      this._p,
      'complete_outline_business_case_month',
      'complete_outline_business_case_year'
    )
  },
  awardContractDate() {
    if (SIMPLIFIED_DATE_TYPES.has(this._p.project_type)) {
      return null
    }
    return formatDate(this._p, 'award_contract_month', 'award_contract_year')
  },
  startConstructionDate() {
    if (SIMPLIFIED_DATE_TYPES.has(this._p.project_type)) {
      return null
    }
    return formatDate(
      this._p,
      'start_construction_month',
      'start_construction_year'
    )
  },
  readyForServiceDate() {
    return formatDate(
      this._p,
      'ready_for_service_month',
      'ready_for_service_year'
    )
  }
}
