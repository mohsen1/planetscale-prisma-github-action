# PlanetScale Prisma Github Action

* Automatically create database branches and deploy request in Github pull requests. 
* Deploy databases to production when a pull request is merged.
* Automatically delete database branches when a pull request is closed or merged.

### Future Features
* Vercel preview with the new database branch


## Work in progress

This is a work in progress. It's being done as a public repository so I can use free Github Action hours 

### To-do items
- [x] Detect Prisma schema changes
- [x] Create a PlanetScale branch with the PR Git branch name
- [ ] Push the schema to the PlanetScale branch 
- [ ] Create a Deploy Request on PlanetScale for the PlanetScale branch 
- [ ] Link the Deploy Request to the PR as a Check
- [ ] Mark the Check as failed until Deploy Request is approved 
- [ ] Make sure Vercel Preview URLs are using the new DB branch 
- [ ] Merge the DB branch on PlanetScale after Git branch is merged into the `main` branch

## How to use

### Setup PlanetScale credentials
You will need the following secrets in your Github repository:

- `PLANETSCALE_SERVICE_TOKEN` - PlanetScale API service token

### Configure Environment Variables

You will need to configure the following environment variables:

- `PLANETSCALE_ORG` - PlanetScale organization name
- `PLANETSCALE_DB` - PlanetScale database name
- `PLANETSCALE_SERVICE_TOKEN_ID` - PlanetScale API service token ID

#### Optional Environment Variables
- `PLANETSCALE_MAIN_BRANCH_NAME` - PlanetScale database branch name (defaults to `main`)
- `PLANETSCALE_BRANCH_PREFIX` - Prefix to use for PlanetScale database branches (defaults to `pull-request-`)
- `PLANETSCALE_DEB_DOWNLOAD_URL` - URL to download the PlanetScale CLI (defaults to the latest release on Github)
- `PRISMA_SCHEMA_FILE_PATH` - Path to the Prisma schema file (defaults to `prisma/schema.prisma`)
- `PRISMA_DB_PUSH_COMMAND` - Command to run to push the Prisma schema to the PlanetScale database (defaults to `npx prisma db push`)

