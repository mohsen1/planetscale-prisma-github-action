#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

// @ts-check

// This script is meant to run by Github Actions.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');


/**
 * @typedef PlanetScaleBranch
 * @property {string} name Name of the branch
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef PlanetScaleDeployRequestDeployment
 * @property {string} state State of the deployment
 * @property {boolean} deployable
 * @property {string | null} started_at When the deployment started
 * @property {string | null} finished_at When the deployment finished
 * @property {string | null} queued_at When the deployment finished
 * 
/**
 * @typedef PlanetScaleDeployRequest
 * @property {string} branch Name of the branch
 * @property {string} id ID of the deploy request
 * @property {boolean} approved Whether the deploy request is approved
 * @property {string} state "open" | "closed"
 * @property {string} created_at Date string
 * @property {string} updated_at Date string
 * @property {string} closed_at Date string
 * @property {PlanetScaleDeployRequestDeployment} deployment
 */

function installPlanetScaleCLI() {
    const PLANETSCALE_DEB_DOWNLOAD_URL =
  'https://github.com/planetscale/cli/releases/download/v0.115.0/pscale_0.115.0_linux_amd64.deb';

    execSync(`wget ${PLANETSCALE_DEB_DOWNLOAD_URL} -O /tmp/pscale.deb`, {
      stdio: 'ignore',
    });
    execSync('sudo dpkg -i /tmp/pscale.deb', { stdio: 'ignore' });
}

async function main() {
  const mainBranch = 'main';
  let approvedDeployRequest = false;

  process.chdir(path.resolve(__dirname, '../..'));

  execSync('git fetch origin --no-tags --prune', { stdio: 'ignore' });
  execSync('touch /tmp/changed-files.txt', { stdio: 'ignore' });
  execSync(
    `git diff --name-only origin/${mainBranch} > /tmp/changed-files.txt`,
    {
      stdio: 'ignore',
    },
  );

  const changedFiles = fs
    .readFileSync('/tmp/changed-files.txt', 'utf8')
    .split('\n');

  if (!changedFiles.includes('prisma/schema.prisma')) {
    console.log('No prisma/schema.prisma changed');
    return;
  }

  const {
    DB_NAME,
    PLANETSCALE_SERVICE_TOKEN,
    PLANETSCALE_SERVICE_TOKEN_ID,
    PLANETSCALE_ORG,
  } = process.env;

  /** `--service-token-id`, `--service-token` and `--org` */
  const authArg = `--service-token-id ${PLANETSCALE_SERVICE_TOKEN_ID} --service-token ${PLANETSCALE_SERVICE_TOKEN} --org ${PLANETSCALE_ORG}`;

  installPlanetScaleCLI();

  const branchName = execSync('git rev-parse --abbrev-ref HEAD')
    .toString()
    .trim();

  /** @type {PlanetScaleBranch[]} */
  const existingBranches = JSON.parse(
    execSync(
      `pscale branch list ${DB_NAME} --no-color --format json ${authArg}`,
    ).toString(),
  );

  if (existingBranches.find(({ name }) => name === branchName)) {
    console.log(`Database branch "${branchName}" already exists`);
  } else {
    console.log('Creating a PlanetScale database branch named', branchName);
    execSync(`pscale branch create ${DB_NAME} ${branchName} ${authArg}`);
  }

  /** @type {PlanetScaleDeployRequest[]} */
  const deployRequests = JSON.parse(
    execSync(
      `pscale deploy-request list peak-performance ${DB_NAME} --format=json ${authArg}`,
    ).toString(),
  );

  const openDeployRequest = deployRequests.find(
    (deployRequest) =>
      deployRequest.branch === branchName && deployRequest.state === 'open',
  );

  if (openDeployRequest) {
    console.log('Found an existing deploy request for', branchName);

    if (openDeployRequest.approved) {
      console.log('Deploy request is already approved');
      approvedDeployRequest = true;
    }
  } else {
    console.log('Creating a deploy request for', branchName);
    execSync(
      `pscale deploy-request create ${DB_NAME} ${branchName} ${authArg}`,
    );
  }

  if (!approvedDeployRequest) {
    throw new Error(`Database deploy request is not approved`);
  }
}

main().catch((err) => {
  console.error(err.stack);
  process.exit(1);
});
