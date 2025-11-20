#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildDatabaseUrl } from './database-url.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

try {
  process.env.DATABASE_URL = buildDatabaseUrl()

  // Use explicit path to prisma binary to prevent PATH injection
  const prismaPath = join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'node_modules',
    '.bin',
    'prisma'
  )

  execSync(`"${prismaPath}" db pull`, {
    stdio: 'inherit',
    env: process.env,
    shell: false
  })
} catch (error) {
  console.error('Failed to pull database schema:', error.message)
  process.exit(1)
}
