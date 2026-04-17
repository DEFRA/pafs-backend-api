import {
  RFCC_CODE_NAMES,
  RISK_LABELS,
  PSO_TO_COASTAL_GROUP_MAP
} from '../fcerm1-labels.js'
import { hasRisk } from '../fcerm1-presenter-utils.js'

export const projectIdentityMixin = {
  referenceNumber() {
    return this._p.reference_number ?? null
  },
  name() {
    return this._p.name ?? null
  },
  region() {
    return this._p.region ?? null
  },
  rfcc() {
    const code = (this._p.reference_number ?? '').substring(0, 2).toUpperCase()
    return RFCC_CODE_NAMES[code] ?? null
  },
  eaArea() {
    return this._area.eaAreaName ?? null
  },
  rmaName() {
    return this._area.rmaName ?? this._p.rma_name ?? null
  },
  rmaType() {
    return this._area.rmaSubType ?? null
  },
  coastalGroup() {
    const hasCoastalRisk =
      hasRisk(this._p, 'coastal_erosion') ||
      hasRisk(this._p, 'sea_flooding') ||
      hasRisk(this._p, 'tidal_flooding')
    if (!hasCoastalRisk) {
      return null
    }
    return PSO_TO_COASTAL_GROUP_MAP[this._area.psoName] ?? null
  },
  projectType() {
    const type = this._p.project_type
    if (type === 'ENV_WITH_HOUSEHOLDS') {
      return 'ENV'
    }
    if (type === 'ENV_WITHOUT_HOUSEHOLDS') {
      return 'ENN'
    }
    return type ?? null
  },
  mainRisk() {
    const risk = this._p.main_risk ?? this._p.main_source_of_risk
    return risk ? (RISK_LABELS[risk] ?? risk) : null
  },
  secondaryRiskSources() {
    const main = this._p.main_risk ?? this._p.main_source_of_risk
    const risks = this._p.project_risks_protected_against
      ? this._p.project_risks_protected_against.split(',').map((r) => r.trim())
      : []
    return risks
      .filter((r) => r !== main)
      .map((r) => RISK_LABELS[r] ?? r)
      .join(' | ')
  }
}
