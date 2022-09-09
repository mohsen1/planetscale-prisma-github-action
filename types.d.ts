declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GITHUB_WORKSPACE: string;
      GITHUB_TOKEN?: string;
    }
  }
}
export {};

export interface PlanetScaleBranch {
  name: string;
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
