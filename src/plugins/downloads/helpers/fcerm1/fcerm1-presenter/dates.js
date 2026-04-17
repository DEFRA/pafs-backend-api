import { formatDate } from '../fcerm1-presenter-utils.js'

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
    return formatDate(
      this._p,
      'complete_outline_business_case_month',
      'complete_outline_business_case_year'
    )
  },
  awardContractDate() {
    return formatDate(this._p, 'award_contract_month', 'award_contract_year')
  },
  startConstructionDate() {
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
