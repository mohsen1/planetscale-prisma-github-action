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
      temporaryDatabaseUrl: results.connection_strings.prisma
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

module.exports = PlanetScale;
