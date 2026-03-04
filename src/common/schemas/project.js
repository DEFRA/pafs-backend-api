/**
 * Project validation schemas
 * This file re-exports schemas from split modules for backward compatibility
 */

// Re-export all basic project schemas
export * from './project/basic.js'

// Re-export financial year schemas
export * from './project/financial-years.js'

// Re-export important dates schemas
export * from './project/important-dates.js'

// Re-export risk and properties schemas
export * from './project/risk-properties.js'

// Re-export goal, urgency & confidence assessment schema
export * from './project/goal-urgency-confidence.js'

// Re-export environment benefits schema
export * from './project/environment-benefits.js'
