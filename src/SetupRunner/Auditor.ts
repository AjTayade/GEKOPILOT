/**
 * @file auditor.ts
 * @description Part 1: The "Auditor".
 * Responsibilities:
 * 1. Reads the .devsetup.json configuration.
 * 2. Checks if required dependencies are installed.
 * 3. Reports the installed version (if available).
 */

import { AuditResult, DependencyRequirement } from "../types";
import * as childProcess from "child_process";

/**
 * Runs the system audit based on provided dependencies.
 * @param requirements Array of DependencyRequirement from .devsetup.json
 * @returns Array of AuditResult
 */
export function runAudit(requirements: DependencyRequirement[]): AuditResult[] {
  const results: AuditResult[] = [];

  for (const dep of requirements) {
    try {
      // Use the corrected camelCase import name
      const versionOutput = childProcess.execSync(`${dep.name} --version`).toString().trim();

      results.push({
        dependency: dep,
        isInstalled: true,
        installedVersion: versionOutput,
      });
    } catch {
      results.push({
        dependency: dep,
        isInstalled: false,
      });
    }
  }

  return results;
}