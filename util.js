const { PLANETSCALE_BRANCH_PREFIX, GITHUB_HEAD_REF } = process.env;

// branch name has to be alphanumeric and start with a letter
const branchName = (PLANETSCALE_BRANCH_PREFIX + GITHUB_HEAD_REF).replace(
  /[^a-zA-Z0-9-]/g,
  "-"
);

module.exports = {
  branchName,
};
