// src/SetupRunner/Executor.ts

import * as cp from "child_process";
import { StdioOptions } from "child_process";
import * as vscode from "vscode";
import { ActionPlan, ActionStep } from "../types";
import { PACKAGE_NAMES } from "./dependencyConfig";

/**
 * Installs a dependency using a safe, constructed command.
 * Output is streamed to the output channel.
 */
function installDependency(step: ActionStep, outputChannel: vscode.OutputChannel): void {
  const { dependency: dep } = step;
  outputChannel.appendLine(`[Executor] Installing ${dep.name}...`);

  // 1. Determine the platform and package manager
  const platform = process.platform; // 'darwin', 'win32', 'linux', etc.
  let safeCommand: string | undefined;

  // 2. Get the safe package name from your config, using the dependency ID
  const packageName = PACKAGE_NAMES[dep.id as keyof typeof PACKAGE_NAMES]?.[platform as keyof typeof PACKAGE_NAMES[keyof typeof PACKAGE_NAMES]];

  if (!packageName) {
    outputChannel.appendLine(`[Executor] ERROR: No installation candidate found for ${dep.name} on this platform.`);
    return;
  }

  // 3. Construct the command safely based on the platform
  if (platform === 'darwin') {
    safeCommand = `brew install ${packageName}`;
  } else if (platform === 'win32') {
    safeCommand = `winget install --id=${packageName} -e`;
  } else if (platform === 'linux') {
    // This is a simplification. A real implementation would need to detect the specific package manager (apt, dnf, etc.)
    outputChannel.appendLine(`[Executor] Assuming 'apt' for Linux. To support other distributions, the package manager detection needs to be implemented.`);
    safeCommand = `sudo apt-get install -y ${packageName}`;
  } else {
    outputChannel.appendLine(`[Executor] ERROR: Unsupported platform: ${platform}`);
    return;
  }


  if (safeCommand) {
    try {
      outputChannel.appendLine(`[Executor] Running: ${safeCommand}`);
      cp.execSync(safeCommand, { stdio: "inherit" as StdioOptions });
      outputChannel.appendLine(`[Executor] Successfully installed ${dep.name}.`);
    } catch (err) {
      const errorDetail = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`[Executor] ERROR: Failed to install ${dep.name}: ${errorDetail}`);
      // Re-throw the error to be caught by the orchestrator
      throw new Error(`Failed to install ${dep.name}. See the output for more details.`);
    }
  } else {
    outputChannel.appendLine(`[Executor] No install command could be constructed for ${dep.name}.`);
  }
}


/**
 * Uninstalls a dependency using its specified uninstallCommand.
 * Output is streamed to the output channel.
 */
function uninstallDependency(step: ActionStep, outputChannel: vscode.OutputChannel): void {
  const { dependency: dep } = step;
  outputChannel.appendLine(`[Executor] Uninstalling ${dep.name}...`);

  if (dep.uninstallCommand) {
    try {
      // ✅ FIX: Apply the same fix for the uninstall command
      cp.execSync(dep.uninstallCommand, { stdio: "inherit" as StdioOptions });
      outputChannel.appendLine(`[Executor] Successfully uninstalled ${dep.name}.`);
    } catch (err) {
      const errorDetail = err instanceof Error ? err.message : String(err);
      outputChannel.appendLine(`[Executor] ERROR: Failed to uninstall ${dep.name}: ${errorDetail}`);
      // Error handling...
    }
  } else {
    outputChannel.appendLine(`[Executor] No uninstall command found for ${dep.name}.`);
  }
}


export async function executePlan(plan: ActionPlan, outputChannel: vscode.OutputChannel): Promise<void> {
  for (const step of plan) {
    switch (step.action) {
      case 'INSTALL':
        installDependency(step, outputChannel);
        break;
      case 'REINSTALL':
        // For simplicity, we can just call install for now.
        // You could add a separate uninstall step first if needed.
        installDependency(step, outputChannel);
        break;
      case 'ALREADY_MET':
        outputChannel.appendLine(`[Executor] Skipping ${step.dependency.name} (already met).`);
        break;
    }
  }
}