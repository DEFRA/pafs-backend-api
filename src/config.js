import convict from 'convict'
import convictFormatWithValidator from 'convict-format-with-validator'

import { serverSchema } from './config/server.js'
import { logSchema } from './config/log.js'
import { postgresSchema } from './config/postgres.js'
import { authSchema } from './config/auth.js'
import { notifySchema } from './config/notify.js'
import { awsSchema } from './config/aws.js'
import { schedulerSchema } from './config/scheduler.js'

convict.addFormats(convictFormatWithValidator)

const config = convict({
  ...serverSchema,
  ...logSchema,
  ...postgresSchema,
  ...authSchema,
  ...notifySchema,
  ...awsSchema,
  ...schedulerSchema
})

config.validate({ allowed: 'strict' })

export { config }
