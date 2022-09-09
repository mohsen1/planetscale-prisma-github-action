#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

// @ts-check

// This script is meant to run by Github Actions.
const core = require("@actions/core");
const { execSync } = require("child_process");

/**
 * Poor man's PlanetScale API client
 */
class PlanetScale {
  constructor() {
    const {
      DB_NAME,
      PLANETSCALE_SERVICE_TOKEN,
      PLANETSCALE_SERVICE_TOKEN_ID,
      PLANETSCALE_ORG,
    } = process.env;

    if (!DB_NAME) {
      throw new Error("DB_NAME environment variable is not set");
    }

    if (!PLANETSCALE_SERVICE_TOKEN) {
      throw new Error("PLANETSCALE_SERVICE_TOKEN environment variable is not set");
    }

    if (!PLANETSCALE_SERVICE_TOKEN_ID) {
      throw new Error("PLANETSCALE_SERVICE_TOKEN_ID environment variable is not set");
    }

    if (!PLANETSCALE_ORG) {
      throw new Error("PLANETSCALE_ORG environment variable is not set");
    }


    this.DB_NAME = DB_NAME;
    this.PLANETSCALE_SERVICE_TOKEN = PLANETSCALE_SERVICE_TOKEN;
    this.PLANETSCALE_SERVICE_TOKEN_ID = PLANETSCALE_SERVICE_TOKEN_ID;
    this.PLANETSCALE_ORG = PLANETSCALE_ORG;
  }

  get args() {
    return [
      `--service-token-id ${this.PLANETSCALE_SERVICE_TOKEN_ID}`,
      `--service-token ${this.PLANETSCALE_SERVICE_TOKEN}`,
      `--org ${this.PLANETSCALE_ORG}`,
      "--json",
      "--no-colors",
    ].join(" ");
  }

  /**
   * @param {string} cmd
   */
  command(cmd) {
    return execSync(`pscale ${cmd} ${this.args}`, { encoding: "utf8" });
  }

  /**
   * @param {"list" | "create"} command
   * @param {string=} branchName
   */
  branch(command, branchName) {
    return this.command(
      `branch ${command} ${this.DB_NAME} ${branchName ? branchName : ""}`
    );
  }

  /**
   * @param {"list" | "create"} command
   * @param {string=} arg Number of deploy request or name of the branch
   */
  deployRequest(command, arg) {
    return this.command(
      `deploy-request ${command} ${this.DB_NAME} ${arg ? arg : ""}`
    );
  }
}

async function main() {
  const {PLANETSCALE_BRANCH_PREFIX} = process.env;
  let approvedDeployRequest = false;

  core.debug(`Changing directory to ${process.env.GITHUB_WORKSPACE}`);

  process.chdir(process.env.GITHUB_WORKSPACE);

  core.debug('ls -al')
  core.debug(execSync(`ls -al`, { encoding: "utf8" }));


  const planetScale = new PlanetScale();

  const gitBranch = execSync("git rev-parse --abbrev-ref HEAD")
    .toString()
    .trim();
  const branchPrefix = PLANETSCALE_BRANCH_PREFIX || "pull-request-";
  const branchName = `${branchPrefix}${gitBranch}`;

  /** @type {import("./types").PlanetScaleBranch[]} */
  const existingBranches = JSON.parse(planetScale.branch("list"));

  if (existingBranches.find(({ name }) => name === branchName)) {
    core.debug(`Database branch "${branchName}" already exists`);
  } else {
    core.debug(`Creating a PlanetScale database branch named ${branchName}`);
    planetScale.branch("create", branchName);
  }

  /** @type {import("./types").PlanetScaleDeployRequest[]} */
  const deployRequests = JSON.parse(planetScale.deployRequest("list"));

  const openDeployRequest = deployRequests.find(
    (deployRequest) =>
      deployRequest.branch === branchName && deployRequest.state === "open"
  );

  if (openDeployRequest) {
    core.debug(`Found an existing deploy request for ${branchName}`);

    if (openDeployRequest.approved) {
      core.debug("Deploy request is already approved");
      approvedDeployRequest = true;
    }
  } else {
    core.debug(`Creating a deploy request for ${branchName}`);
    planetScale.deployRequest("create", branchName);
  }

  if (!approvedDeployRequest) {
    throw new Error(`Database deploy request for "${branchName}" branch is not approved`);
  }
}

main().catch((err) => {
  throw err
});
