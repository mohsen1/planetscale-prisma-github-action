# PlanetScale Prisma Github Action

- Automatically create database branches and deploy request in Github pull requests.
- Automatically delete database branches when a pull request is closed or merged.

### Future Features
- Mark Github Check as pending until PlanetScale deploy request is approved. (This requires PlanetScale to support Web Hooks. TBD)
- Deploy databases to production when a pull request is merged.
- Vercel preview with the new database branch

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

Use this Github Action with the following configuration. We are depending on [tj-actions/changed-files](https://github.com/marketplace/actions/changed-files) to detect if the Prisma schema has changed. Note that `fetch-depth: 0` in `actions/checkout` is required for this action to work.



```yaml
steps:
  - uses: actions/checkout@v3
    with:
      fetch-depth: 0 # important: required for tj-actions/changed-files to work

  - name: Get changed files
    id: changed-files
    uses: tj-actions/changed-files@v29.0.4


  - uses: mohsen1/planetscale-prisma-github-action@main
    # Only run this action if the Prisma schema has changed
    if: contains(steps.changed-files.outputs.modified_files, 'schema/prisma.schema')
    with:
      # Repository Github token (Automatically provided by Github Actions)
      github-token: ${{ secrets.GITHUB_TOKEN }}
      # The name of the PlanetScale database to use
      database: my-database
      # The name of the PlanetScale organization to use
      organization: my-organization
      # The name of the PlanetScale service account to use
      planetscale-service-token-id: my-service-token-id
      # The PlanetScale API key to use
      planetscale-service-token: ${{ secrets.PLANETSCALE_SERVICE_TOKEN }}
```
