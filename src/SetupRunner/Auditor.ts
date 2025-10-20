/**
 * @file auditor.ts
 * @description Part 1: The "Auditor".
 * Responsibilities:
 * 1. Checks if required dependencies are installed using specified commands.
 * 2. Attempts to parse and report the installed version.
 */

import { AuditResult, DependencyRequirement } from "../types";
import * as childProcess from "child_process";
import * as semver from "semver"; // Import semver

/**
 * Parses version strings to extract a valid semantic version.
 * Handles common prefixes like 'v' or 'version '.
 * Returns null if no valid semver is found.
 */
function parseVersion(output: string): string | null {
    if (!output) { return null; } // FIX: Added braces

    // Try simple semver match first (e.g., "16.0.0", "v18.2.1")
    let match = output.match(/v?(\d+\.\d+\.\d+)/);
    if (match && match[1] && semver.valid(match[1])) {
        return match[1];
    }

    // Try matching lines like "Python 3.10.4"
    match = output.match(/(?:version\s+|is\s+)(\d+\.\d+\.\d+)/i);
     if (match && match[1] && semver.valid(match[1])) {
        return match[1];
    }

    // Add more complex regex if needed for specific tools (e.g., git version 2.34.1)
     match = output.match(/version\s+(\d+\.\d+\.\d+)/i);
     if (match && match[1] && semver.valid(match[1])) {
        return match[1];
    }

    // Fallback: If output itself is a valid version (less likely but possible)
    if (semver.valid(output.trim())) {
        return output.trim();
    }

    // Could add more specific parsers based on known tool outputs
    console.warn(`[Auditor] Could not parse semver from output: "${output}"`); // Log warning if parsing fails
    return output.trim(); // Return raw output as fallback
}


/**
 * Runs the system audit based on provided dependencies.
 * @param requirements Array of DependencyRequirement from .devsetup.json
 * @returns Array of AuditResult
 */
export function runAudit(requirements: DependencyRequirement[]): AuditResult[] {
  const results: AuditResult[] = [];
  console.log('[Auditor] Starting audit for dependencies:', requirements.map(d => d.name));

  for (const dep of requirements) { // FIX: Added braces (though for loop usually has them)
    // FIX: Use the specific cliName and versionFlag if provided
    const cli = dep.cliName || dep.name;
    const flag = dep.versionFlag || '--version';
    const command = `"${cli}" ${flag}`; // Quote cli in case path has spaces

    try {
      console.log(`[Auditor] Executing: ${command}`);
      // Use execSync safely for version check - typically fast, non-interactive.
      // Increased buffer size in case version commands output a lot (unlikely but safe)
      const versionOutput = childProcess.execSync(command, { stdio: 'pipe', encoding: 'utf8', maxBuffer: 1024 * 1024 }).toString().trim();
      const installedVersion = parseVersion(versionOutput);

      console.log(`[Auditor] Output for ${cli}: "${versionOutput}", Parsed: "${installedVersion}"`);

      results.push({
        dependency: dep,
        isInstalled: true,
        installedVersion: installedVersion, // Store potentially null or raw version
        notes: installedVersion ? undefined : `Could not parse version from output: ${versionOutput}`
      });

    } catch (error: any) {
        console.error(`[Auditor] Error executing command for ${cli}: ${error.message}`);
        // Log stderr if available
        // FIX: Added braces
        if (error.stderr) {
             console.error(`[Auditor] Stderr for ${cli}: ${error.stderr.toString().trim()}`);
        }
      results.push({
        dependency: dep,
        isInstalled: false,
        notes: `Command execution failed: ${error.message}`
      });
    }
  }
  console.log('[Auditor] Audit complete. Results:', results);
  return results;
}