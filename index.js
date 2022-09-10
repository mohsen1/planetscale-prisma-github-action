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
  /** @param {(error: string) => Promise<void>} onFailedCommand */
  constructor(onFailedCommand) {
    this.onFailedCommand = onFailedCommand;
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
    try {
      return execSync(`pscale ${cmd} ${this.args}`, { encoding: "utf8" });
    } catch (/** @type {any} */ error) {
      this.onFailedCommand(error.message).catch(console.error);
      throw error;
    }
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

  /**
   * @param {string} branchName
   */
  createConnectionUrl(branchName) {
    const name =
      "temporary-github-pull-request-automation-" +
      Math.random().toString(36).substring(2, 15);

    /** @type {import("./types").PlanetScalePasswordResult} */
    const results = JSON.parse(
      this.command(`password create ${this.DB_NAME} ${branchName} ${name}`)
    );

    return {
      name,
      DATABASE_URL: results.connection_strings.prisma
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("url = "))
        ?.replace('url = "', "")
        .replace(/"$/, ""),
    };
  }

  /**
   * @param {string} branchName
   * @param {string} name password name
   */
  deleteConnectionUrl(branchName, name) {
    return this.command(
      `password delete ${this.DB_NAME} ${branchName} ${name}`
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
    PRISMA_DB_PUSH_COMMAND,
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
      comment.user?.url === "https://github.com/apps/github-actions" &&
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

  /** @type {import("./types").PlanetScaleBranch[]} */
  const existingBranches = JSON.parse(planetScale.branch("list"));
  const existingBranch = existingBranches.find(
    ({ name }) => name === branchName
  );

  if (existingBranch) {
    core.debug(
      `Database branch "${branchName}" already exists: ${existingBranch}`
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
  const { name, DATABASE_URL } = planetScale.createConnectionUrl(branchName);
  core.debug(`Created a temporary connection URL named ${name}`);

  core.debug(`Running the db push command: ${PRISMA_DB_PUSH_COMMAND}`);
  execSync(PRISMA_DB_PUSH_COMMAND, {
    env: {
      ...process.env,
      DATABASE_URL,
    },
    cwd: GITHUB_WORKSPACE,
    uid: 0, // run as root
  });

  core.debug(`Deleting the temporary connection URL named ${name}`);
  planetScale.deleteConnectionUrl(branchName, name);

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
        ? `<p>${deployRequestLink} <b>was approved</b></p>`
        : `<p>Waiting for ${deployRequestLink} to be approved by a PlanetScale admin</p>`
    ),
  });
}

main().catch((err) => {
  core.setFailed(err.message);
});
