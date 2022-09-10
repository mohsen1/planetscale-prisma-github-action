#!/usr/bin/env node

const PlanetScale = require("../PlanetScale");
const fs = require("fs");
const core = require("@actions/core");

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

  core.debug(
    `Deleting the temporary connection URL named "${passwordName}" for "${branchName}" branch`
  );

  planetScale.deleteConnectionUrl(branchName, passwordName);
}

cleanup().catch(console.error);
