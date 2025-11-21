import bcrypt from 'bcrypt'
import { PASSWORD } from '../../constants.js'
import { createLogger } from '../logging/logger.js'

const logger = createLogger()

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, PASSWORD.BCRYPT_ROUNDS)
}

export async function verifyPassword(plainPassword, hashedPassword) {
  if (!hashedPassword?.startsWith(PASSWORD.BCRYPT_PREFIX)) {
    return false
  }

  try {
    return await bcrypt.compare(plainPassword, hashedPassword)
  } catch (error) {
    logger.debug({ err: error }, 'Password verification failed')
    return false
  }
}
