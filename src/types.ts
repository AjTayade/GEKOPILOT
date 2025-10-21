// src/types.ts
// ------------------------------------------------------
// Centralized type definitions for all modules.
// ------------------------------------------------------

/** A dependency entry as defined in .devsetup.json */
export interface DependencyRequirement {
  id: string;                  // unique identifier (e.g., "node")
  name: string;                // human-readable name
  requiredVersion?: string;     // semantic version requirement, e.g. ">=16.0.0"
  installCommand?: string;     // optional custom install command
  uninstallCommand?: string; // optional explicit uninstall command
  cliName?: string;          // the CLI binary to probe (e.g. "node" or "python3")
  versionFlag?: string;      // flag to produce version, e.g. "-v" or "--version"
}

// Represents the result of auditing a dependency
export interface AuditResult {
  dependency: DependencyRequirement;
  isInstalled: boolean;
  installedVersion?: string | null;
  notes?: string;
}

// One actionable step in the setup plan
export interface ActionStep {
  dependency: DependencyRequirement;
  action: "INSTALL" | "REINSTALL" | "ALREADY_MET";
  reason: string;
}

// The full plan (array of steps)
export type ActionPlan = ActionStep[];

// Result of running requirement checks (for Orchestrator)
export interface CheckResult {
  ok: boolean;                 // true if requirements passed
  details?: string;            // human-readable summary
  missing?: string[];          // list of missing dependencies, if any
}

// Information about a step that failed automatic execution
export interface FailedStepInfo {
    dependencyName: string;
    action: "INSTALL" | "REINSTALL"; // Add UNINSTALL if needed separately
    errorMessage: string;
}

// Result of executing the action plan
export interface ExecutionResult {
  totalSteps: number;
  stepsAttempted: number; // Steps where automatic action was tried (INSTALL/REINSTALL)
  stepsSucceeded: number; // Steps that completed successfully automatically
  stepsSkippedSudo: number; // Steps skipped because they required manual sudo
  stepsFailed: number; // Steps that failed during automatic execution
  manualSudoCommands: string[]; // List of commands the user needs to run
  failedStepsInfo: FailedStepInfo[]; // Details about failed steps
}

// Result of the entire setup process, including dependency execution, scaffold, and final setup
export interface SetupResult {
  success: boolean;            // true if setup/scaffold succeeded *fully automatically* AND no deps failed
  message?: string;            // description or error message
  partialSuccess?: boolean;    // true if some steps required manual intervention but none failed
  manualStepsRequired?: string[]; // Commands user needed to run
  failedSteps?: FailedStepInfo[]; // Details about failed dependency steps
}


// Optional interfaces if you want to strongly type module interactions later
export interface IRequirementsChecker {
  checkRequirements(workspaceRoot: string): Promise<CheckResult>;
}

export interface ISetupRunner {
  runSetup(
    workspaceRoot: string,
    config?: any,
    onProgress?: (msg: string) => void
  ): Promise<SetupResult>;
}

export interface IProjectScaffold {
  scaffoldProject(
    workspaceRoot: string,
    config?: any,
    onProgress?: (msg: string) => void
  ): Promise<SetupResult>;
}