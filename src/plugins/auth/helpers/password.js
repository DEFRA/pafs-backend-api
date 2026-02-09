import bcrypt from 'bcrypt'
import { PASSWORD } from '../../../common/constants/index.js'
import { createLogger } from '../../../common/helpers/logging/logger.js'

const logger = createLogger()

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, PASSWORD.BCRYPT_ROUNDS)
}

export async function verifyPassword(plainPassword, hashedPassword) {
  // Accept bcrypt hashes with valid prefixes
  // $2a: Original bcrypt, $2b: OpenBSD/Ruby on Rails, $2x/$2y: Other variants
  if (!hashedPassword?.match(PASSWORD.BCRYPT_VALID_PREFIXES)) {
    return false
  }

  try {
    return await bcrypt.compare(plainPassword, hashedPassword)
  } catch (error) {
    logger.debug({ err: error }, 'Password verification failed')
    return false
  }
}
