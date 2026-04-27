import { sumFunding, sumContributors } from '../fcerm1-presenter-utils.js'

export const fundingStreamsMixin = {
  fcermGia(year) {
    return sumFunding(this._p.pafs_core_funding_values, year, 'fcerm_gia')
  },
  assetReplacementAllowance(year) {
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'asset_replacement_allowance'
    )
  },
  environmentStatutoryFunding(year) {
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'environment_statutory_funding'
    )
  },
  frequentlyFloodedCommunities(year) {
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'frequently_flooded_communities'
    )
  },
  otherAdditionalGrantInAid(year) {
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'other_additional_grant_in_aid'
    )
  },
  otherGovernmentDepartment(year) {
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'other_government_department'
    )
  },
  recovery(year) {
    return sumFunding(this._p.pafs_core_funding_values, year, 'recovery')
  },
  summerEconomicFund(year) {
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'summer_economic_fund'
    )
  },
  localLevy(year) {
    return sumFunding(this._p.pafs_core_funding_values, year, 'local_levy')
  },
  internalDrainageBoards(year) {
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'internal_drainage_boards'
    )
  },
  notYetIdentified(year) {
    return sumFunding(
      this._p.pafs_core_funding_values,
      year,
      'not_yet_identified'
    )
  },
  publicContributions(year) {
    return sumContributors(
      this._p.pafs_core_funding_values,
      this._contributors,
      year,
      'public_contributions'
    )
  },
  privateContributions(year) {
    return sumContributors(
      this._p.pafs_core_funding_values,
      this._contributors,
      year,
      'private_contributions'
    )
  },
  otherEaContributions(year) {
    return sumContributors(
      this._p.pafs_core_funding_values,
      this._contributors,
      year,
      'other_ea_contributions'
    )
  }
}
