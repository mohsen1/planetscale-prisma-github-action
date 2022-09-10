#!/usr/bin/env node

// @ts-check

const PlanetScale = require("./PlanetScale");
const fs = require("fs");
const core = require("@actions/core");

async function merge() {
  const planetScale = new PlanetScale(async (error) => {
    core.setFailed(error);
  });

  core.debug("Merging the deploy request into the main branch");

  planetScale.deployRequest("deploy");
}

merge().catch((err) => {
  core.setFailed(err.message);
});
