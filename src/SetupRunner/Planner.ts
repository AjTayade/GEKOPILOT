/**
 * @file planner.ts
 * @description Part 2: The "Planner".
 * Responsibilities:
 * 1. Takes the raw audit results from the Auditor.
 * 2. Compares required vs installed version.
 * 3. Creates a structured ActionPlan for Executor.
 */

import * as semver from "semver";
// CORRECTED IMPORT PATH: Was "../types", now "./types"
import { AuditResult, ActionPlan, ActionStep } from "../types"; 

/**
 * Creates an ActionPlan based on the audit results.
 */
export function createActionPlan(auditResults: AuditResult[]): ActionPlan {
  const plan: ActionPlan = [];

  for (const result of auditResults) {
    plan.push(determineAction(result));
  }

  return plan;
}

/**
 * Determines the action for a single dependency.
 */
function determineAction(result: AuditResult): ActionStep {
  const { dependency, isInstalled, installedVersion } = result;

  if (!isInstalled) {
    return {
      dependency,
      action: "INSTALL",
      reason: `${dependency.name} is not installed.`,
    };
  }
  
  // Check for version satisfaction if requiredVersion is specified
  if (dependency.requiredVersion && installedVersion) {
    if (semver.satisfies(installedVersion, dependency.requiredVersion)) {
        return {
            dependency,
            action: "ALREADY_MET",
            reason: `${dependency.name} is installed at a compatible version (${installedVersion}).`,
        };
    }
  } else if (!dependency.requiredVersion) {
      // If no version is required, and it's installed, then it's met.
      return {
            dependency,
            action: "ALREADY_MET",
            reason: `${dependency.name} is installed (${installedVersion || "version not detected"}). No specific version required.`,
      };
  }

  // Handle cases where versions are incompatible
  const requiredVersionDisplay = dependency.requiredVersion || "any";

  return {
    dependency,
    action: "REINSTALL",
    reason: `${dependency.name} is installed at an incompatible version (${installedVersion || "unknown"}). Required: ${requiredVersionDisplay}.`,
  };
}