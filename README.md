# PAFS Backend API

[![License](https://img.shields.io/badge/license-OGL--UK--3.0-blue.svg)](http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3)
[![Node.js](https://img.shields.io/badge/node-22-brightgreen.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16-blue.svg)](https://www.postgresql.org/)
[![Liquibase](https://img.shields.io/badge/liquibase-4.25-orange.svg)](https://www.liquibase.org/)
[![CDP](https://img.shields.io/badge/CDP-Platform-green.svg)](https://github.com/DEFRA/cdp-documentation)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_pafs-backend-api&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_pafs-backend-api)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_pafs-backend-api&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_pafs-backend-api)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_pafs-backend-api&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_pafs-backend-api)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_pafs-backend-api&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_pafs-backend-api)

Backend API for the Project Application and Funding Service (PAFS) - RESTful APIs for managing flood and coastal erosion risk management projects.

## Overview

**Purpose:** RESTful API for user authentication, authorization, and data management

**Tech Stack:**

- Node.js 22 + Hapi.js 21
- PostgreSQL 16 (Aurora Serverless V2) + Prisma ORM
- Liquibase 4.25 for schema migrations
- JWT authentication + bcrypt
- Vitest + Docker + CDP deployment

**Key Features:**

- User authentication and authorization
- Account provisioning workflow
- Role-based access control
- Database schema versioning
- Health check endpoints

## Table of Contents

- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [VS Code Setup](#vs-code-setup)
- [Database Migrations](#database-migrations)
- [Development](#development)
- [Schema Changes](#schema-changes)
- [Docker](#docker)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Related Links](#related-links)
- [Licence](#licence)

## Requirements

**Node.js:** >= 22  
**npm:** >= 11  
**PostgreSQL:** >= 16  
**Liquibase:** 4.25 (via Docker or standalone)

**Install Node.js:**

```bash
# Using nvm (recommended)
nvm install 22
nvm use 22
```

**Install PostgreSQL:**

```bash
# Mac
brew install postgresql@16

# Linux
sudo apt-get install postgresql-16

# Windows: Download from postgresql.org
```

## Quick Start

```bash
# Clone repository
git clone https://github.com/DEFRA/pafs-backend-api.git
cd pafs-backend-api

# Install dependencies
nvm use  # Use Node version from .nvmrc
npm install

# Setup database
psql -U postgres
CREATE DATABASE pafs_backend_local;
CREATE USER pafs_user WITH PASSWORD 'pafs_password';
GRANT ALL PRIVILEGES ON DATABASE pafs_backend_local TO pafs_user;
\q

# Configure Liquibase
cp liquibase.properties.template liquibase.properties
# Edit liquibase.properties with your credentials

# Run migrations
npm run db:migrate

# Start development server
npm run dev
```

Application runs at `http://localhost:3001`

## VS Code Setup

**Recommended for debugging and development.**

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Dev Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal",
      "env": {
        "NODE_ENV": "development",
        "PORT": "3001"
      }
    }
  ]
}
```

**Run:** Press `F5` or use Run and Debug panel

## Prisma Schema

**Location:** `prisma/schema.prisma`  
**Purpose:** Type-safe database access with auto-generated client

### Workflow

1. **Pull schema from database** (via VS Code) → Generates `schema.prisma` from existing database
2. **Generate Prisma Client** (via npm) → Creates type-safe client for database access

### Pull Schema from Database (VS Code)

**Use VS Code launch configuration to pull schema:**

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "PAFS Backend API - Prisma Pull",
  "skipFiles": ["<node_internals>/**"],
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "prisma:db:pull"],
  "console": "integratedTerminal",
  "env": {
    "DB_HOST": "127.0.0.1",
    "DB_PORT": "5432",
    "DB_DATABASE": "pafs_backend_api",
    "DB_USERNAME": "postgres",
    "DB_PASSWORD": "pgadmin",
    "DB_USE_IAM_AUTHENTICATION": "false"
  }
}
```

**Run:** Press `F5` and select "PAFS Backend API - Prisma Pull"

This pulls the database schema and generates/updates `prisma/schema.prisma` file.

### Generate Prisma Client (npm)

**After pulling schema, generate the Prisma Client:**

```bash
npm run prisma:generate
```

This generates the type-safe Prisma Client based on your schema.

**Note:** This runs automatically on `npm install` (postinstall hook)

**Important:**

- Run `prisma:db:pull` via VS Code to generate schema from database
- Run `prisma:generate` via npm to create Prisma Client
- Prisma works alongside Liquibase (Liquibase manages migrations, Prisma provides type-safe access)

## Database Migrations

**Tool:** Liquibase 4.25  
**Location:** `changelog/` directory  
**Format:** XML changesets

**Setup:**

```bash
# Copy template
cp liquibase.properties.template liquibase.properties

# Edit liquibase.properties with your database credentials
```

**Run Migrations:**

**Option 1: Using Docker**

```bash
# Interactive shell (recommended for multiple commands)
docker run -it --rm --network host \
  -v "$(pwd):/liquibase/workspace" \
  -w /liquibase/workspace \
  liquibase/liquibase:4.25 sh

# Then inside container:
liquibase --defaults-file=liquibase.properties validate
liquibase --defaults-file=liquibase.properties status
liquibase --defaults-file=liquibase.properties update
exit

# Or single command:
docker run --rm --network host \
  -v "$(pwd):/liquibase/workspace" \
  -w /liquibase/workspace \
  liquibase/liquibase:4.25 \
  --defaults-file=liquibase.properties update
```

**Option 2: Using Podman**

```bash
# Interactive shell
podman run -it --rm --network host \
  -v "$(pwd):/liquibase/workspace:Z" \
  -w /liquibase/workspace \
  liquibase/liquibase:4.25 sh

# Then inside container:
liquibase --defaults-file=liquibase.properties validate
liquibase --defaults-file=liquibase.properties status
liquibase --defaults-file=liquibase.properties update
exit

# Or single command:
podman run --rm --network host \
  -v "$(pwd):/liquibase/workspace:Z" \
  -w /liquibase/workspace \
  liquibase/liquibase:4.25 \
  --defaults-file=liquibase.properties update
```

**Option 3: Using standalone Liquibase**

```bash
liquibase --defaults-file=liquibase.properties update
```

**Important Notes:**

- For Docker/Podman on Windows/Mac: Use `host.docker.internal` in `liquibase.properties` instead of `localhost`
- For Podman: The `:Z` flag is required for SELinux contexts
- For standalone Liquibase: Download from [liquibase.org](https://www.liquibase.org/download)

## Development

**Run Development Server:**

```bash
npm run dev  # Nodemon with hot reload
```

**Run Tests:**

```bash
npm test              # Run tests with coverage
npm run test:watch    # Watch mode
```

**Available Scripts:**

```bash
npm run dev           # Development server
npm start             # Production server
npm test              # Run tests
npm run lint          # Lint code
npm run format        # Format code
```

## Schema Changes

**Create New Changeset:**

1. Add XML file to `changelog/`
2. Follow naming: `{version}-{sequence}-{description}.xml`
3. Test locally with `npm run db:migrate`
4. Create PR (automatic validation runs)
5. After merge, publish via GitHub Actions

**Automatic Validation:**

- PR checks validate changelog syntax
- Runs migration on test database
- Ensures no broken migrations

## Docker

**Build:**

```bash
# Development
docker build --target development -t pafs-backend-api:dev .

# Production
docker build -t pafs-backend-api .
```

**Run:**

```bash
docker run -p 3001:3001 pafs-backend-api
```

## Environment Variables

| Variable       | Description           | Default       |
| -------------- | --------------------- | ------------- |
| `NODE_ENV`     | Environment           | `development` |
| `PORT`         | Server port           | `3001`        |
| `LOG_LEVEL`    | Log level             | `info`        |
| `DATABASE_URL` | PostgreSQL connection | -             |
| `JWT_SECRET`   | JWT signing secret    | -             |

**CDP Environments:** Manage secrets via [CDP Portal](https://portal.cdp-int.defra.cloud/)

## Deployment

**Automated (GitHub Actions):**

1. Push to `main` → Build & test
2. Tests pass → Docker image built
3. Image published to CDP
4. Deploy via CDP Portal

**Manual:**

- [CDP Portal](https://portal.cdp-int.defra.cloud/) → Select service → Choose environment → Deploy

## Related Links

- [PAFS Portal Frontend](https://github.com/DEFRA/pafs-portal-frontend)
- [CDP Documentation](https://github.com/DEFRA/cdp-documentation)
- [Liquibase Documentation](https://docs.liquibase.com/)

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3
