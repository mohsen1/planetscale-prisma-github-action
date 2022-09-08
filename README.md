# PlanetScale Prisma Github Action

Automatically create database branches and deploy request in Github pull requests


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
