import { toNumber } from '../fcerm1-presenter-utils.js'

export const adminMixin = {
  // ── Project status ────────────────────────────────────────────────────────

  projectStatus() {
    const state = this._p._state
    if (!state) {
      return null
    }
    return state.charAt(0).toUpperCase() + state.slice(1)
  },

  // ── Carbon impact ─────────────────────────────────────────────────────────

  carbonCostBuild() {
    return toNumber(this._p, 'carbon_cost_build')
  },
  carbonCostOperation() {
    return toNumber(this._p, 'carbon_cost_operation')
  },
  carbonCostSequestered() {
    return toNumber(this._p, 'carbon_cost_sequestered')
  },
  carbonCostAvoided() {
    return toNumber(this._p, 'carbon_cost_avoided')
  },
  carbonSavingsNetEconomicBenefit() {
    return toNumber(this._p, 'carbon_savings_net_economic_benefit')
  },
  carbonOperationalCostForecast() {
    return toNumber(this._p, 'carbon_operational_cost_forecast')
  },

  // ── Audit / admin columns ─────────────────────────────────────────────────

  lastUpdated() {
    return this._p.updated_at ? this._p.updated_at.toISOString() : null
  },
  lastUpdatedBy() {
    return this._p._updatedByName ?? null
  },
  lastUpdatedByEmail() {
    return this._p._updatedByEmail ?? null
  },
  psoName() {
    return this._area.psoName ?? null
  }
}
