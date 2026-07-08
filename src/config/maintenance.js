export const maintenanceSchema = {
  maintenance: {
    legacyCompletedFix: {
      enabled: {
        doc:
          'Enable the one-time endpoint that corrects legacy proposals ' +
          "incorrectly set to 'completed' status by updating them to 'submitted'. " +
          'Must be explicitly set to true to activate; defaults to false to ' +
          'prevent accidental execution.',
        format: Boolean,
        default: true,
        env: 'MAINTENANCE_LEGACY_COMPLETED_FIX_ENABLED'
      }
    }
  }
}
