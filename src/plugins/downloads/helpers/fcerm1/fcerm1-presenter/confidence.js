import { CONFIDENCE_LABELS } from '../fcerm1-labels.js'
import { lookupLabel } from '../fcerm1-presenter-utils.js'

export const confidenceMixin = {
  confidenceHomesBetterProtected() {
    return lookupLabel(
      this._p,
      CONFIDENCE_LABELS,
      'confidence_homes_better_protected'
    )
  },
  confidenceHomesByGatewayFour() {
    return lookupLabel(
      this._p,
      CONFIDENCE_LABELS,
      'confidence_homes_by_gateway_four'
    )
  },
  confidenceSecuredPartnershipFunding() {
    return lookupLabel(
      this._p,
      CONFIDENCE_LABELS,
      'confidence_secured_partnership_funding'
    )
  }
}
