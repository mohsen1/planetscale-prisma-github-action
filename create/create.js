#!/usr/bin/env node

// @ts-check

// This script is meant to run by Github Actions.
const core = require("@actions/core");
const github = require("@actions/github");
const fs = require("fs");

const PlanetScale = require("../PlanetScale");
const {
  branchName,
  createCommentBody,
  getComment,
  getOpenDeployRequest,
  updateCommentFor,
} = require("../util");

async function main() {
  const { GITHUB_TOKEN, GITHUB_WORKSPACE, PLANETSCALE_ORG, DB_NAME } =
    process.env;

  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }

  const octokit = github.getOctokit(GITHUB_TOKEN);

  const comments = await octokit.rest.issues.listComments({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: github.context.issue.number,
  });

  core.debug(`Existing Github comments: ${JSON.stringify(comments, null, 2)}`);

  const comment = await getComment();

  core.debug(`Changing directory to ${GITHUB_WORKSPACE}`);

  process.chdir(GITHUB_WORKSPACE);

  const planetScale = new PlanetScale(async (error) => {
    const body = createCommentBody(
      `<p>Failed to run the automation</p><pre>${error}</pre>`
    );
    if (comment) {
      await octokit.rest.issues.updateComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        comment_id: comment.id,
        body,
      });
    } else {
      await octokit.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: github.context.issue.number,
        body,
      });
    }
  });

  core.setOutput("database-branch-name", branchName);
  fs.writeFileSync("/tmp/planetscale-branch-name", branchName);

  /** @type {import("../types").PlanetScaleBranch[]} */
  const existingBranches = JSON.parse(planetScale.branch("list"));
  const existingBranch = existingBranches.find(
    ({ name }) => name === branchName
  );

  if (existingBranch) {
    core.debug(
      `Database branch "${branchName}" already exists: ${JSON.stringify(
        existingBranch
      )}`
    );
  } else {
    core.debug(`Creating a PlanetScale database branch named ${branchName}`);
    planetScale.branch("create", branchName);
    while (true) {
      core.debug(`Waiting for the branch to be ready`);
      /** @type {import("../types").PlanetScaleBranch[]} */
      const branches = JSON.parse(planetScale.branch("list"));

      if (branches.find(({ name }) => name === branchName)?.ready) {
        core.debug(`Branch is ready`);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Push schema
  const { name, temporaryDatabaseUrl } =
    planetScale.createConnectionUrl(branchName);
  core.debug(`Created a temporary connection URL named ${name}`);

  core.setOutput("temporary-database-url", temporaryDatabaseUrl);
  core.setOutput("temporary-password-name", name);

  fs.writeFileSync("/tmp/planetscale-password-name", name);

  const openDeployRequest = await getOpenDeployRequest(branchName);

  await updateCommentFor(openDeployRequest);

  core.setOutput("deploy-request-number", openDeployRequest.number);
  core.setOutput("deploy-request-state", openDeployRequest.state);
  core.setOutput(
    "deploy-request-approved",
    JSON.stringify(Boolean(openDeployRequest.approved))
  );
}

main().catch((err) => {
  core.setFailed(err.message);
});
