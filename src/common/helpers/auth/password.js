import bcrypt from 'bcrypt'
import { PASSWORD } from '../../constants'

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
    return false
  }
}
