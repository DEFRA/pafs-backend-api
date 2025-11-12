# PAFS Backend API

[![License](https://img.shields.io/badge/license-OGL--UK--3.0-blue.svg)](http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%3E%3D15-blue.svg)](https://www.postgresql.org/)
[![Liquibase](https://img.shields.io/badge/liquibase-4.25.0-orange.svg)](https://www.liquibase.org/)
[![CDP](https://img.shields.io/badge/CDP-Core%20Delivery%20Platform-green.svg)](https://portal.cdp-int.defra.cloud/documentation/README.md)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_pafs-backend-api&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_pafs-backend-api)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_pafs-backend-api&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_pafs-backend-api)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_pafs-backend-api&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_pafs-backend-api)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_pafs-backend-api&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_pafs-backend-api)

Backend API for the **Project Application and Funding Service (PAFS)** built on the Core Delivery Platform (CDP). This service provides RESTful APIs for managing flood and coastal erosion risk management projects.

> **PAFS** helps Risk Management Authorities submit and manage funding applications for flood and coastal erosion risk management projects across England.

## Features

- **RESTful API** - Built with Hapi.js framework
- **PostgreSQL Database** - Robust relational database with full schema management
- **Liquibase Migrations** - Version-controlled database schema changes
- **Automated Testing** - Comprehensive test coverage with Vitest
- **Docker Support** - Containerized deployment ready
- **CDP Integration** - Deployed on Core Delivery Platform
- **CI/CD Pipeline** - Automated testing and deployment via GitHub Actions
- **Schema Validation** - Automatic PR checks for database migrations
- **Monitoring & Logging** - Integrated observability with ECS logging

## Table of Contents

- [PAFS Backend API](#pafs-backend-api)
  - [Features](#features)
  - [Table of Contents](#table-of-contents)
  - [Requirements](#requirements)
    - [Node.js](#nodejs)
    - [PostgreSQL](#postgresql)
  - [Getting Started](#getting-started)
    - [Clone Repository](#clone-repository)
    - [Install Dependencies](#install-dependencies)
    - [VS Code Launch Configuration](#vs-code-launch-configuration)
    - [Database Setup](#database-setup)
  - [Database Migration](#database-migration)
    - [Prerequisites](#prerequisites)
    - [Local Migration (Standalone Liquibase)](#local-migration-standalone-liquibase)
    - [Local Migration (Docker)](#local-migration-docker)
      - [Quick Start](#quick-start)
      - [Inside Container](#inside-container)
    - [Verify Migration](#verify-migration)
  - [Local Development](#local-development)
    - [Run with npm](#run-with-npm)
    - [Run with VS Code](#run-with-vs-code)
    - [Testing](#testing)
    - [Production Mode](#production-mode)
  - [Publishing Schema Changes](#publishing-schema-changes)
    - [Automatic Validation (PR)](#automatic-validation-pr)
    - [Manual Publish](#manual-publish)
    - [Making Schema Changes](#making-schema-changes)
    - [Npm Scripts](#npm-scripts)
    - [Update Dependencies](#update-dependencies)
    - [Formatting](#formatting)
      - [Windows Prettier Issue](#windows-prettier-issue)
  - [Development Helpers](#development-helpers)
    - [Proxy](#proxy)
  - [Related Links](#related-links)
  - [Environment Variables](#environment-variables)
    - [Local Development](#local-development-1)
    - [CDP Environments](#cdp-environments)
  - [Deployment](#deployment)
    - [CDP Deployment (Automated)](#cdp-deployment-automated)
  - [Additional Resources](#additional-resources)
    - [Changelog Files](#changelog-files)
    - [GitHub Workflows](#github-workflows)
    - [Configuration Files](#configuration-files)
    - [Dependabot](#dependabot)
    - [SonarCloud](#sonarcloud)
  - [Licence](#licence)
    - [About the licence](#about-the-licence)

## Requirements

### Node.js

**Required Version:** Node.js `>= v22` and npm `>= v11`

**Option 1: Using Node Version Manager (Recommended)**

1. Install [nvm (Node Version Manager)](https://github.com/nvm-sh/nvm):

   **Windows:**
   - Download and install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)

   **macOS/Linux:**

   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   ```

2. Install Node.js v22:

   ```bash
   nvm install 22
   nvm use 22
   ```

3. Verify installation:
   ```bash
   node --version  # Should show v22.x.x
   npm --version   # Should show v11.x.x or higher
   ```

**Option 2: Direct Installation**

Download and install Node.js v22+ from [nodejs.org](https://nodejs.org/)

**Using .nvmrc:**

This project includes an `.nvmrc` file. If you have nvm installed:

```bash
cd pafs-backend-api
nvm use
```

### PostgreSQL

PostgreSQL `>= v15` is required. Install PostgreSQL:

- **Windows**: [Download PostgreSQL](https://www.postgresql.org/download/windows/)
- **Mac**: `brew install postgresql@16`
- **Linux**: `sudo apt-get install postgresql-16`

## Getting Started

### Clone Repository

```bash
git clone https://github.com/DEFRA/pafs-backend-api.git
cd pafs-backend-api
```

### Install Dependencies

1. **Use the correct Node version (if using nvm):**

   ```bash
   nvm use
   ```

   This reads the version from `.nvmrc` file.

2. **Install dependencies:**
   ```bash
   npm install
   ```

### VS Code Launch Configuration

**Recommended approach for running the application in VS Code.**

1. **Create `.vscode/launch.json`** in the project root:

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
           "PORT": "3000"
         }
       }
     ]
   }
   ```

2. **Benefits of using launch.json:**
   - No need to create `.env` file
   - Can be committed to Git (no secrets)
   - Easy to switch between configurations
   - Integrated debugging in VS Code
   - Team members get the same setup

### Database Setup

Create a local PostgreSQL database:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE pafs_backend_local;
CREATE USER pafs_user WITH PASSWORD 'pafs_password';
GRANT ALL PRIVILEGES ON DATABASE pafs_backend_local TO pafs_user;
\q
```

## Database Migration

The database schema is managed using [Liquibase](https://www.liquibase.org/). You can run migrations using either standalone Liquibase or Docker.

### Prerequisites

- PostgreSQL database running (see [Database Setup](#database-setup))
- Liquibase configuration file with your credentials

**Setup Liquibase Configuration:**

1. **Copy the template file:**

   ```bash
   cp liquibase.properties.template liquibase.properties
   ```

2. **Edit `db/liquibase.properties`** and replace placeholders:

   ```properties
   username: <YOUR_USERNAME>  # Replace with your PostgreSQL username
   password: <YOUR_PASSWORD>  # Replace with your PostgreSQL password
   ```

3. **Choose the correct database URL based on your setup:**
   - **Option 1: Liquibase in Docker + PostgreSQL on Host** (RECOMMENDED - DEFAULT)
     - You run commands **inside** Docker container: `docker run ... liquibase/liquibase sh`
     - PostgreSQL runs on your host machine
     - **Windows/Mac:** Use `host.docker.internal` (already set as default)
       ```properties
       url: jdbc:postgresql://host.docker.internal:5432/<database_name>
       ```
   - **Option 2: Standalone Liquibase** (Liquibase installed locally)
     - You run: `liquibase --defaults-file=liquibase.properties update`
     - Uncomment this line:
     ```properties
     url: jdbc:postgresql://localhost:5432/<database_name>
     ```

> [!CAUTION]
> **NEVER commit `db/liquibase.properties` to Git!** It's already in `.gitignore` to prevent accidental commits. Only the template file should be committed.

### Local Migration (Standalone Liquibase)

**Requires:** [Liquibase CLI](https://www.liquibase.org/download) installed locally.

```bash
# Validate changelog
liquibase --defaults-file=liquibase.properties validate

# Check migration status
liquibase --defaults-file=liquibase.properties status

# Run migration
liquibase --defaults-file=liquibase.properties update

# Rollback last changeset (if needed)
liquibase --defaults-file=liquibase.properties rollback-count 1
```

### Local Migration (Docker)

**No Liquibase installation required!** Just Docker.

#### Quick Start

```bash
# Run Liquibase container interactively
docker run -it --rm --network host -v "$(pwd):/liquibase/workspace" -w /liquibase/workspace liquibase/liquibase:4.25 sh

OR

# Run Liquibase container interactively with podman
podman run -it --rm --network host -v "$(pwd):/liquibase/workspace:Z" -w /liquibase/workspace liquibase/liquibase:4.25 sh
```

Then update `db/liquibase.properties` to use `host.docker.internal` instead of `localhost` on Windows.

#### Inside Container

```bash
# Validate
liquibase --defaults-file=liquibase.properties validate

# Status
liquibase --defaults-file=liquibase.properties status

# Run migration
liquibase --defaults-file=liquibase.properties update

# Exit
exit
```

### Verify Migration

Connect to your database and verify:

```bash
psql -h localhost -U pafs_user -d pafs_backend_local

# List tables
\dt

# Check changesets applied
SELECT COUNT(*) FROM databasechangelog;
-- Should return 20

# Exit
\q
```

## Local Development

### Run with npm

To run the application in `development` mode:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Run with VS Code

**Option 1: Using VS Code (Recommended)**

1. Open the project in VS Code
2. Press `F5` or go to **Run and Debug** panel (Ctrl+Shift+D)
3. Select a configuration:
   - **Dev Server** - Development mode with hot reload
   - **Production Server** - Test production build
4. Click the green play button or press `F5`

**Option 2: Command Line**

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

The application will be available at **http://localhost:3000**

**VS Code Extensions (Recommended):**

- **Prettier** - Code formatter
- **ESLint** - JavaScript linting
- **Docker** - Container management

### Testing

To test the application run:

```bash
npm run test
```

### Production Mode

To mimic the application running in `production` mode locally:

```bash
npm start
```

## Publishing Schema Changes

### Automatic Validation (PR)

When you create a pull request, the **Check Liquibase Schema** workflow automatically:

1. Validates changelog syntax
2. Runs migration on a temporary test database
3. Verifies all tables are created correctly

**Workflow:** `.github/workflows/check-schema.yml`

This ensures broken migrations cannot be merged.

### Manual Publish

To publish schema changes to an environment:

1. Go to **Actions** tab in GitHub
2. Select **Publish Liquibase Schema** workflow
3. Click **Run workflow**
4. Enter the version (e.g., `1.0.0`)
5. Click **Run workflow**

**Workflow:** `.github/workflows/publish-schema.yml`

This publishes the changelog to the CDP artifact repository for deployment.

### Making Schema Changes

1. Create a new changeset file in `db/changelog/changes/`
2. Add the changeset to `db/changelog/db.changelog.xml`
3. Test locally using Liquibase (standalone or Docker)
4. Create a PR - automatic validation will run
5. After merge, manually publish using the workflow

### Npm Scripts

All available npm scripts:

```bash
npm run                    # List all scripts
npm run dev                # Start development server
npm run test               # Run tests
npm run test:watch         # Run tests in watch mode
npm start                  # Start production server
npm run format             # Format code with Prettier
npm run lint               # Lint code with ESLint
```

View all scripts in [package.json](./package.json).

### Update Dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

```bash
ncu --interactive --format group
```

### Formatting

#### Windows Prettier Issue

If you are having issues with formatting of line breaks on Windows:

```bash
git config --global core.autocrlf false
```

## Development Helpers

### Proxy

We are using forward-proxy which is set up by default. To make use of this: `import { fetch } from 'undici'` then
because of the `setGlobalDispatcher(new ProxyAgent(proxyUrl))` calls will use the ProxyAgent Dispatcher

If you are not using Wreck, Axios or Undici or a similar http that uses `Request`. Then you may have to provide the
proxy dispatcher:

To add the dispatcher to your own client:

```javascript
import { ProxyAgent } from 'undici'

return await fetch(url, {
  dispatcher: new ProxyAgent({
    uri: proxyUrl,
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
})
```

## Related Links

- **[PAFS Portal Frontend](https://github.com/DEFRA/pafs-portal-frontend)** - Portal frontend for PAFS
- **[PAFS Prototype](https://github.com/DEFRA/pafs-prototype)** - GOV.UK Prototype Kit frontend for PAFS
- **[CDP Documentation](https://portal.cdp-int.defra.cloud/documentation/README.md)** - Core Delivery Platform documentation
- **[CDP PAFS Team](https://portal.cdp-int.defra.cloud/teams/pafs-updates)** - Manage team member, deployments and secrets of all PAFS services

## Environment Variables

### Local Development

**For Local Development:**

- Use `launch.json` (recommended) - See [VS Code Launch Configuration](#vs-code-launch-configuration)
- Database connection is configured in `db/liquibase.properties`

**Available Variables:**

| Variable    | Description      | Default       |
| ----------- | ---------------- | ------------- |
| `NODE_ENV`  | Environment mode | `development` |
| `PORT`      | Server port      | `3000`        |
| `LOG_LEVEL` | Logging level    | `info`        |

### CDP Environments

**All environment variables and secrets are managed via CDP Portal:**

1. Go to [CDP Portal](https://portal.cdp-int.defra.cloud/)
2. Navigate to your service → **Secrets** tab
3. Add secrets as key-value pairs
4. Re-deploy the service

**Never commit secrets to Git!**

## Deployment

### CDP Deployment (Automated)

Deployment to CDP environments is automated via GitHub Actions:

1. **Push to main branch** → Triggers build and test
2. **Tests pass** → Docker image is built
3. **Image published** → Available in CDP artifact repository
4. **Deploy via CDP Portal** → Select environment and deploy

**Workflow:** `.github/workflows/publish.yml`

## Additional Resources

### Changelog Files

All database changesets are located in `db/changelog/changes/`

Master changelog: `db/changelog/db.changelog.xml`

### GitHub Workflows

- **`.github/workflows/check-pull-request.yml`** - Automatic PR validation for code changes
- **`.github/workflows/check-schema.yml`** - Automatic PR validation for schema changes
- **`.github/workflows/publish-schema.yml`** - Manual workflow to publish schema versions
- **`.github/workflows/publish.yml`** - Main CI/CD pipeline for application deployment

### Configuration Files

- **`db/liquibase.properties`** - Local development database configuration
- **`package.json`** - npm scripts and dependencies
- **`.nvmrc`** - Node.js version specification

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties)

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
