#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { buildDatabaseUrl } from './database-url.js'

process.env.DATABASE_URL = buildDatabaseUrl()

const prisma = spawn('prisma', ['db', 'pull'], {
  stdio: 'inherit',
  shell: true,
  env: process.env
})

prisma.on('exit', (code) => {
  process.exit(code)
})
