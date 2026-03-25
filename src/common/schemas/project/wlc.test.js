describe('wlc.js schema', () => {
  let schemas
  beforeAll(async () => {
    schemas = await import('./wlc.js')
  })

  const requiredSchemas = [
    'wlcEstimatedWholeLifePvCostsRequiredSchema',
    'wlcEstimatedDesignConstructionCostsRequiredSchema',
    'wlcEstimatedRiskContingencyCostsRequiredSchema',
    'wlcEstimatedFutureCostsRequiredSchema'
  ]
  const optionalSchemas = [
    'wlcEstimatedWholeLifePvCostsOptionalSchema',
    'wlcEstimatedDesignConstructionCostsOptionalSchema',
    'wlcEstimatedRiskContingencyCostsOptionalSchema',
    'wlcEstimatedFutureCostsOptionalSchema'
  ]

  it('validates correct required WLC cost values', () => {
    for (const key of requiredSchemas) {
      const { error, value } = schemas[key].validate('123456')
      expect(error).toBeUndefined()
      expect(value).toBe('123456')
    }
  })

  it('fails required WLC cost for non-digits', () => {
    for (const key of requiredSchemas) {
      const { error } = schemas[key].validate('12abc')
      expect(error).toBeDefined()
    }
  })

  it('fails required WLC cost for too many digits', () => {
    const longStr = '1'.repeat(19)
    for (const key of requiredSchemas) {
      const { error } = schemas[key].validate(longStr)
      expect(error).toBeDefined()
    }
  })

  it('fails required WLC cost for empty string', () => {
    for (const key of requiredSchemas) {
      const { error } = schemas[key].validate('')
      expect(error).toBeDefined()
    }
  })

  it('validates optional WLC cost with valid string, null, or empty', () => {
    for (const key of optionalSchemas) {
      expect(schemas[key].validate('123').error).toBeUndefined()
      expect(schemas[key].validate(null).error).toBeUndefined()
      expect(schemas[key].validate('').error).toBeUndefined()
    }
  })

  it('fails optional WLC cost for non-digits', () => {
    for (const key of optionalSchemas) {
      const { error } = schemas[key].validate('abc')
      expect(error).toBeDefined()
    }
  })

  it('fails optional WLC cost for too many digits', () => {
    const longStr = '1'.repeat(19)
    for (const key of optionalSchemas) {
      const { error } = schemas[key].validate(longStr)
      expect(error).toBeDefined()
    }
  })

  it('trims whitespace for required and optional schemas', () => {
    for (const key of [...requiredSchemas, ...optionalSchemas]) {
      const { value } = schemas[key].validate('   123   ')
      expect(value).toBe('123')
    }
  })
})
