# PlanetScale Prisma Github Action

- Automatically create database branches and deploy request in Github pull requests.
- Automatically delete database branches when a pull request is closed or merged.
- Deploy databases to production when a pull request is merged.

### Future Features

- Export a `DATABASE_URL` for deploying previews (Like Vercel preview) based on the database branch
- Mark Github Check as pending until PlanetScale deploy request is approved. (This requires PlanetScale to support Web Hooks. TBD)

## How to use

**See [example](./example/)**
