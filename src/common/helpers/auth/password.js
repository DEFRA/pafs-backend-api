import bcrypt from 'bcrypt'

const BCRYPT_ROUNDS = 12

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS)
}

export async function verifyPassword(plainPassword, hashedPassword) {
  if (!hashedPassword || !hashedPassword.startsWith('$2')) {
    return false
  }

  try {
    return await bcrypt.compare(plainPassword, hashedPassword)
  } catch (error) {
    return false
  }
}
