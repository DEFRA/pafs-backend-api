#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { buildDatabaseUrl } from './database-url.js'

try {
  process.env.DATABASE_URL = buildDatabaseUrl()

  // Execute prisma db pull
  execSync('prisma db pull', {
    stdio: 'inherit',
    env: process.env
  })
} catch (error) {
  console.error('Failed to pull database schema:', error.message)
  process.exit(1)
}
