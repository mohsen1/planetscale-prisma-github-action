declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GITHUB_WORKSPACE: string;
      GITHUB_TOKEN?: string;
      PLANETSCALE_SERVICE_TOKEN: string;
      PLANETSCALE_SERVICE_TOKEN_ID: string;
      PLANETSCALE_ORG: string;
      DB_NAME: string;
      PLANETSCALE_MAIN_BRANCH_NAME: string;
      PLANETSCALE_BRANCH_PREFIX: string;
      PRISMA_DB_PUSH_COMMAND: string;
    }
  }
}
export {};

export interface PlanetScaleBranch {
  name: string;
  ready: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanetScaleDeployRequestDeployment {
  /** State of the deployment */
  state: string;
  deployable: boolean;
  /** When the deployment started */
  started_at: string | null;
  /** When the deployment finished */
  finished_at: string | null;
  /** When the deployment finished */
  queued_at: string | null;
}

export interface PlanetScaleDeployRequest {
  /** Name of the branch */
  branch: string;
  /** ID of the deploy request */
  id: string;
  /** Deploy request number */
  number: number;
  /** Whether the deploy request is approved */
  approved: boolean;
  state: "open" | "closed";
  /** Date string */
  created_at: string;
  /** Date string */
  updated_at: string;
  /** Date string */
  closed_at: string;
  deployment: PlanetScaleDeployRequestDeployment;
}

export interface PlanetScalePasswordResult {
  id: string;
  display_name: string;
  username: string;
  plain_text: string;
  role: string;
  database_branch: {
    name: string;
  };
  created_at: string;
  updated_at: string;
  connection_strings: {
    prisma: string;
    general: string;
  };
}

export interface PlanetScaleDeployRequestDiff {
  name: string;
  raw: string;
  html: string;
}
