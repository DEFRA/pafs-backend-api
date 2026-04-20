import { buildContributorRows } from '../fcerm1-presenter-utils.js'
import { projectIdentityMixin } from './project-identity.js'
import { projectDetailsMixin } from './project-details.js'
import { datesMixin } from './dates.js'
import { fundingStreamsMixin } from './funding-streams.js'
import { outcomesMixin } from './outcomes.js'
import { confidenceMixin } from './confidence.js'
import { adminMixin } from './admin.js'
import { newTemplateMixin } from './new-template.js'
import { nfmMixin } from './nfm.js'

export {
  RFCC_CODE_NAMES,
  RISK_LABELS,
  MODERATION_LABELS,
  SOP_LABELS,
  CONFIDENCE_LABELS
} from '../fcerm1-labels.js'

export class FcermPresenter {
  constructor(project, areaHierarchy = {}, contributors = []) {
    this._p = project
    this._area = areaHierarchy
    this._contributors = contributors
  }

  fundingContributorsSheetData() {
    return buildContributorRows(
      this._p.pafs_core_funding_values,
      this._contributors,
      this.referenceNumber()
    )
  }

  projectProtectsHouseholds() {
    return (
      Boolean(this._p.reduced_risk_of_households_for_floods) ||
      Boolean(this._p.reduced_risk_of_households_for_coastal_erosion)
    )
  }
}

Object.assign(
  FcermPresenter.prototype,
  projectIdentityMixin,
  projectDetailsMixin,
  datesMixin,
  fundingStreamsMixin,
  outcomesMixin,
  confidenceMixin,
  adminMixin,
  newTemplateMixin,
  nfmMixin
)
