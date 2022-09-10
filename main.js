#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

// @ts-check

// This script is meant to run by Github Actions.
const core = require("@actions/core");
const github = require("@actions/github");
const fs = require("fs");
const { execSync } = require("child_process");

const PlanetScale = require("./PlanetScale");

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

  const cleanContent = content.replace(
    new RegExp(process.env.PLANETSCALE_SERVICE_TOKEN, "g"),
    "pscale_tkn_***"
  );
  return `${header}${cleanContent}${footer}`;
}

async function main() {
  const {
    PLANETSCALE_BRANCH_PREFIX,
    GITHUB_TOKEN,
    GITHUB_WORKSPACE,
    GITHUB_HEAD_REF,
    PLANETSCALE_ORG,
    DB_NAME,
  } = process.env;
  let approvedDeployRequest = false;

  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }

  core.debug(`Running as ${github.context.actor}`);
  core.debug(`whoami: ${execSync("whoami")}`);

  const octokit = github.getOctokit(GITHUB_TOKEN);

  const comments = await octokit.rest.issues.listComments({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: github.context.issue.number,
  });

  core.debug(`Existing Github comments: ${JSON.stringify(comments, null, 2)}`);

  let comment = comments.data.find(
    (comment) =>
      comment.user?.login === "github-actions[bot]" &&
      comment.body?.includes("PLANETSCALE_PRISMA_GITHUB_ACTION_COMMENT")
  );

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

  // branch name has to be alphanumeric and start with a letter
  const branchName = (PLANETSCALE_BRANCH_PREFIX + GITHUB_HEAD_REF).replace(
    /[^a-zA-Z0-9-]/g,
    "-"
  );

  core.setOutput("database-branch-name", branchName);
  fs.writeFileSync("/tmp/planetscale-branch-name", branchName);

  /** @type {import("./types").PlanetScaleBranch[]} */
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
      /** @type {import("./types").PlanetScaleBranch[]} */
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

  core.setOutput("deploy-request-number", openDeployRequest?.number);
  core.setOutput("deploy-request-state", openDeployRequest?.state);
  core.setOutput(
    "deploy-request-approved",
    JSON.stringify(Boolean(openDeployRequest?.approved))
  );

  const deployRequestLink = `
    <a href='https://app.planetscale.com/${PLANETSCALE_ORG}/${DB_NAME}/deploy-requests/${openDeployRequest?.number}'>
      Deploy request #${openDeployRequest?.number}
    </a> for 
    <a href="https://app.planetscale.com/${PLANETSCALE_ORG}/${DB_NAME}/${branchName}">
      <code>${branchName}</code> branch
    </a>`;

  /** @type {import("./types").PlanetScaleDeployRequestDiff[]} */
  const diffs = JSON.parse(
    planetScale.deployRequest("diff", String(openDeployRequest?.number))
  );
  const diffsBody = diffs
    .map(
      ({ name, raw }) =>
        `<details><summary>Schema changes (${name})</summary>\n\n\n\`\`\`diff\n${raw}\`\`\`\n\n\n</details>`
    )
    .join("\n");

  await octokit.rest.issues.updateComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    comment_id: comment.id,
    body: createCommentBody(
      (approvedDeployRequest
        ? `<p>${deployRequestLink} <b>was approved</b></p>`
        : `<p>Waiting for ${deployRequestLink} to be approved by a PlanetScale admin</p>`) +
        diffsBody
    ),
  });
}

main().catch((err) => {
  core.setFailed(err.message);
});
