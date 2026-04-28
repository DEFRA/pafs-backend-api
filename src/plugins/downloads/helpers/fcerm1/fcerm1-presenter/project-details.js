import {
  MODERATION_LABELS,
  FLOOD_RISK_SYMBOLS,
  COASTAL_BEFORE_SYMBOLS,
  COASTAL_AFTER_SYMBOLS,
  lookupSopLabel
} from '../fcerm1-labels.js'
import { yOrN } from '../fcerm1-presenter-utils.js'

export const projectDetailsMixin = {
  moderationCode() {
    return (
      MODERATION_LABELS[this._p.urgency_reason] ?? MODERATION_LABELS.not_urgent
    )
  },
  consented() {
    return yOrN(this._p.consented)
  },
  gridReference() {
    return this._p.grid_reference ?? null
  },
  county() {
    return this._p.county ?? null
  },
  parliamentaryConstituency() {
    return this._p.parliamentary_constituency ?? null
  },
  approach() {
    return this._p.approach ?? null
  },
  floodProtectionBefore() {
    return lookupSopLabel(this._p.flood_protection_before, FLOOD_RISK_SYMBOLS)
  },
  floodProtectionAfter() {
    return lookupSopLabel(this._p.flood_protection_after, FLOOD_RISK_SYMBOLS)
  },
  coastalProtectionBefore() {
    return lookupSopLabel(
      this._p.coastal_protection_before,
      COASTAL_BEFORE_SYMBOLS
    )
  },
  coastalProtectionAfter() {
    return lookupSopLabel(
      this._p.coastal_protection_after,
      COASTAL_AFTER_SYMBOLS
    )
  },
  strategicApproach() {
    return yOrN(this._p.strategic_approach)
  },
  rawPartnershipFundingScore() {
    return this._p.raw_partnership_funding_score ?? null
  },
  adjustedPartnershipFundingScore() {
    return this._p.adjusted_partnership_funding_score ?? null
  },
  pvWholeLifeCosts() {
    return this._p.pv_whole_life_costs ?? null
  },
  pvWholeLifeBenefits() {
    return this._p.pv_whole_life_benefits ?? null
  },
  durationOfBenefits() {
    return this._p.duration_of_benefits ?? null
  },
  benefitCostRatio() {
    const benefits = this._p.pv_whole_life_benefits
    const costs = this._p.pv_whole_life_costs
    if (benefits == null || !costs) {
      return null
    }
    return Math.round((benefits / costs) * 10) / 10
  },
  publicContributors() {
    return this._p.public_contributions
      ? (this._p.public_contributor_names ?? null)
      : null
  },
  privateContributors() {
    return this._p.private_contributions
      ? (this._p.private_contributor_names ?? null)
      : null
  },
  otherEaContributors() {
    return this._p.other_ea_contributions
      ? (this._p.other_ea_contributor_names ?? null)
      : null
  }
}
