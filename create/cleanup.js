#!/usr/bin/env node

// @ts-check

const PlanetScale = require("../PlanetScale");
const fs = require("fs");
const core = require("@actions/core");
const { getOpenDeployRequest, updateCommentFor } = require("../util");

async function cleanup() {
  const planetScale = new PlanetScale(async (error) => {
    throw error;
  });

  const branchName = fs
    .readFileSync("/tmp/planetscale-branch-name", "utf8")
    .toString()
    .trim();
  const passwordName = fs
    .readFileSync("/tmp/planetscale-password-name", "utf8")
    .toString()
    .trim();

  // Update the comment one more time to have the diffs...
  const openDeployRequest = await getOpenDeployRequest(branchName);
  if (openDeployRequest) {
    updateCommentFor(openDeployRequest);
  }

  core.debug(
    `Deleting the temporary connection URL named "${passwordName}" for "${branchName}" branch`
  );

  planetScale.deleteConnectionUrl(branchName, passwordName);
}

cleanup().catch(console.error);
