#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

// @ts-check

// This script is meant to run by Github Actions.
const core = require("@actions/core");
const github = require("@actions/github");
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
      throw new Error(
        "PLANETSCALE_SERVICE_TOKEN environment variable is not set"
      );
    }

    if (!PLANETSCALE_SERVICE_TOKEN_ID) {
      throw new Error(
        "PLANETSCALE_SERVICE_TOKEN_ID environment variable is not set"
      );
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
      "--format json",
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

function createCommentBody(
  content = "Working...",
  header = `<h4>PlanetScale deploy request</h4>`
) {
  const footer = `
    <br>
    <sub>
      <a href="https://github.com/mohsen1/planetscale-prisma-github-action">
        PlanetScale Prisma Github Action
      </a>
    </sub>
    <!-- PLANETSCALE_PRISMA_GITHUB_ACTION_COMMENT -->
    `;

  return `${header}${content}${footer}`;
}

async function main() {
  const {
    PLANETSCALE_BRANCH_PREFIX,
    GITHUB_TOKEN,
    GITHUB_WORKSPACE,
    PLANETSCALE_ORG,
    DB_NAME,
  } = process.env;
  let approvedDeployRequest = false;

  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }

  const octokit = github.getOctokit(GITHUB_TOKEN);

  const comments = await octokit.rest.issues.listComments({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: github.context.issue.number,
  });

  let comment = comments.data.find((comment) => {
    comment.user?.url === "https://github.com/apps/github-actions" &&
      comment.body?.includes("PLANETSCALE_PRISMA_GITHUB_ACTION_COMMENT");
  });

  if (!comment) {
    core.info("No existing comment found, creating a new one");
    comment = (
      await octokit.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: github.context.issue.number,
        body: createCommentBody(
          "Creating a new deploy request for this branch..."
        ),
      })
    ).data;
  }

  core.debug(`Changing directory to ${GITHUB_WORKSPACE}`);

  process.chdir(GITHUB_WORKSPACE);

  const planetScale = new PlanetScale();

  const gitBranchName = execSync("${GITHUB_REF##*/}", { encoding: "utf8" });
  const branchName =
    (PLANETSCALE_BRANCH_PREFIX || "pull-request-") + gitBranchName;

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
  const branchDeployRequest = deployRequests.filter(
    ({ branch }) => branch === branchName
  );

  let openDeployRequest = branchDeployRequest.find(
    ({ state }) => state === "open"
  );

  if (!openDeployRequest) {
    core.debug(`Creating a deploy request for ${branchName}`);
    openDeployRequest = JSON.parse(
      planetScale.deployRequest("create", branchName)
    );
  }

  const deployRequestLink = `
    <a href='https://app.planetscale.com/${PLANETSCALE_ORG}/${DB_NAME}/deploy-requests/${openDeployRequest?.number}'>
      Deploy request #${openDeployRequest?.number}
    </a> for 
    <a href="https://app.planetscale.com/${PLANETSCALE_ORG}/${DB_NAME}/${branchName}">
      <code>${branchName}</code> branch
    </a>`;

  await octokit.rest.issues.updateComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    comment_id: comment.id,
    body: createCommentBody(
      approvedDeployRequest
        ? `<p>${deployRequestLink} was approved</p>`
        : `<p>Waiting for ${deployRequestLink} to be approved by a PlanetScale admin</p>`
    ),
  });
}

main().catch((err) => {
  core.setFailed(err.message);
});
