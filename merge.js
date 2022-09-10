#!/usr/bin/env node

// @ts-check

const PlanetScale = require("./PlanetScale");
const core = require("@actions/core");
const { branchName } = require("./util");

async function merge() {
  const planetScale = new PlanetScale(async (error) => {
    core.setFailed(error);
  });

  core.debug("Merging the deploy request into the main branch");

  /** @type {import("./types").PlanetScaleDeployRequest[]} */
  const deployRequests = JSON.parse(planetScale.deployRequest("list"));

  const openDeployRequest = deployRequests.find(
    ({ state, branch }) => state === "open" && branch === branchName
  );

  if (!openDeployRequest) {
    core.debug(`No open deploy request for ${branchName}`);
    return;
  }

  core.debug(`Merging the deploy request for ${branchName}`);
  planetScale.deployRequest("deploy", openDeployRequest.id);

  while (true) {
    core.debug(`Waiting for the deploy request to be merged`);
    /** @type {import("./types").PlanetScaleDeployRequest[]} */
    const deployRequests = JSON.parse(planetScale.deployRequest("list"));

    if (
      deployRequests.find(
        ({ id, deployment }) =>
          id === openDeployRequest.id && deployment.finished_at
      )
    ) {
      core.debug(`Deploy request deployed`);
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  core.debug(`Deleting the branch ${branchName}`);
  planetScale.branch("delete", branchName);

  while (true) {
    core.debug(`Waiting for the branch to be deleted`);
    /** @type {import("./types").PlanetScaleBranch[]} */
    const branches = JSON.parse(planetScale.branch("list"));

    if (!branches.find(({ name }) => name === branchName)) {
      core.debug(`Branch is deleted`);
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

merge().catch((err) => {
  core.setFailed(err.message);
});
