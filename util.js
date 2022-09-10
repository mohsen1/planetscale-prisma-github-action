const github = require("@actions/github");
const core = require("@actions/core");
const { execSync } = require("child_process");
const PlanetScale = require("./PlanetScale");

// @ts-check

const { PLANETSCALE_BRANCH_PREFIX, GITHUB_HEAD_REF, GITHUB_TOKEN } =
  process.env;

// branch name has to be alphanumeric and start with a letter
const branchName = (PLANETSCALE_BRANCH_PREFIX + GITHUB_HEAD_REF).replace(
  /[^a-zA-Z0-9-]/g,
  "-"
);

const octokit = github.getOctokit(GITHUB_TOKEN);

const planetScale = new PlanetScale(async (error) => {
  throw error;
});

/** @param {string} body */
async function updateComment(body) {
  const comment = await getComment();

  await octokit.rest.issues.updateComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    comment_id: comment.id,
    body: createCommentBody(body),
  });
}

/**
 * // TODO: fix types
 * @returns {Promise<{id: number}>}
 */
async function getComment() {
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
  return comment;
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

/**
 *
 * @param {string} branchName
 */
async function getOpenDeployRequest(branchName) {
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
    const url = `https://github.com/${github.context.repo.owner}/${github.context.repo.repo}/pull/${github.context.payload.pull_request?.number}`;
    const planetScaleComment = `This deploy request was automatically created by schema changes in ${url}`;
    planetScale.deployRequest(
      "review",
      `${openDeployRequest?.number} --comment "${planetScaleComment}"`
    );
  }

  if (!openDeployRequest) {
    throw new Error("Failed to create a deploy request");
  }

  return openDeployRequest;
}

/**
 *
 * @param {import("./types").PlanetScaleDeployRequest} openDeployRequest
 */
async function updateCommentFor(openDeployRequest) {
  const comment = await getComment();

  const deployRequestLink = `
    <a href='https://app.planetscale.com/${PLANETSCALE_ORG}/${DB_NAME}/deploy-requests/${openDeployRequest.number}'>
      Deploy request #${openDeployRequest.number}
    </a> for 
    <a href="https://app.planetscale.com/${PLANETSCALE_ORG}/${DB_NAME}/${branchName}">
      <code>${branchName}</code>
    </a> database branch`;

  /** @type {import("./types").PlanetScaleDeployRequestDiff[]} */
  const diffs = JSON.parse(
    planetScale.deployRequest("diff", String(openDeployRequest.number))
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
      (openDeployRequest.approved
        ? `<p>${deployRequestLink}<b> was approved</b></p>`
        : `<p>Waiting for ${deployRequestLink} to be approved by a PlanetScale admin</p>`) +
        diffsBody
    ),
  });
}

module.exports = {
  getComment,
  createCommentBody,
  branchName,
  updateComment,
  getOpenDeployRequest,
  updateCommentFor,
};
