export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'validation.email.required' }
  }

  const trimmed = email.trim()

  if (trimmed.length === 0) {
    return { valid: false, error: 'validation.email.required' }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'validation.email.invalid_format' }
  }

  return { valid: true, value: trimmed.toLowerCase() }
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string' || password.length === 0) {
    return { valid: false, error: 'validation.password.required' }
  }

  return { valid: true, value: password }
}
