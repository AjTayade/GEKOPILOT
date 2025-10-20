// src/SetupRunner/Executor.ts

import * as cp from "child_process";
import { StdioOptions, spawn } from "child_process"; // Use spawn
import * as vscode from "vscode";
import * as fs from 'fs'; // Import fs for existsSync
import { ActionPlan, ActionStep, DependencyRequirement } from "../types"; // Added DependencyRequirement
import { PACKAGE_NAMES } from "./dependencyConfig";

// Helper function to detect Linux package manager (Simple version)
function detectLinuxPackageManager(): 'apt' | 'dnf' | 'pacman' | 'zypper' | null {
    // Check in common binary locations
    const pathsToCheck = ['/usr/bin/', '/bin/', '/usr/sbin/', '/sbin/'];
    for (const p of pathsToCheck) { // FIX: Added braces
        // FIX: Added braces
        if (fs.existsSync(`${p}apt-get`)) { return 'apt'; }
        if (fs.existsSync(`${p}dnf`)) { return 'dnf'; }
        if (fs.existsSync(`${p}pacman`)) { return 'pacman'; }
        if (fs.existsSync(`${p}zypper`)) { return 'zypper'; }
    }
    // Check if the command exists in PATH using 'which' or 'where'
     try {
        // FIX: Added braces
        if (process.platform === 'win32') {
            cp.execSync('where apt-get', { stdio: 'ignore' }); return 'apt';
        } else {
            cp.execSync('which apt-get', { stdio: 'ignore' }); return 'apt';
        }
     } catch {}
     try {
         // FIX: Added braces
         if (process.platform === 'win32') {
             cp.execSync('where dnf', { stdio: 'ignore' }); return 'dnf';
         } else {
             cp.execSync('which dnf', { stdio: 'ignore' }); return 'dnf';
         }
     } catch {}
     try {
          // FIX: Added braces
          if (process.platform === 'win32') {
             cp.execSync('where pacman', { stdio: 'ignore' }); return 'pacman';
         } else {
             cp.execSync('which pacman', { stdio: 'ignore' }); return 'pacman';
         }
     } catch {}
      try {
          // FIX: Added braces
          if (process.platform === 'win32') {
             cp.execSync('where zypper', { stdio: 'ignore' }); return 'zypper';
         } else {
             cp.execSync('which zypper', { stdio: 'ignore' }); return 'zypper';
         }
     } catch {}


    return null; // Return null if none are found
}

/**
 * Executes a command asynchronously using spawn, streaming output.
 */
function runCommandAsync(
    command: string,
    args: string[],
    outputChannel: vscode.OutputChannel,
    operationName: string, // e.g., "install", "uninstall"
    dependencyName: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        outputChannel.appendLine(`[Executor] Running: ${command} ${args.join(' ')}`);
        try {
            const child = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: process.platform === 'win32' // Use shell on Windows for commands like winget
            });

            child.stdout?.on('data', (data) => {
                outputChannel.appendLine(data.toString().trim());
            });

            child.stderr?.on('data', (data) => {
                const stdErrLine = data.toString().trim();
                const prefix = stdErrLine.toLowerCase().includes('error') ? '[STDERR/ERROR]' : '[STDERR]';
                outputChannel.appendLine(`${prefix} ${stdErrLine}`);
            });

            child.on('error', (err) => {
                outputChannel.appendLine(`[Executor] ERROR: Failed to start ${operationName} process for ${dependencyName}: ${err.message}`);
                reject(err);
            });

            child.on('close', (code) => {
                // FIX: Added braces
                if (code === 0) {
                    outputChannel.appendLine(`[Executor] Successfully finished ${operationName} for ${dependencyName}.`);
                    resolve();
                } else {
                    const errorMsg = `[Executor] ERROR: ${operationName} process for ${dependencyName} exited with code ${code}. Check output above.`;
                    outputChannel.appendLine(errorMsg);
                    reject(new Error(errorMsg));
                }
            });
        } catch (spawnError: any) {
            outputChannel.appendLine(`[Executor] ERROR: Failed to spawn ${operationName} process for ${dependencyName}: ${spawnError.message}`);
            reject(spawnError);
        }
    });
}


/**
 * Installs a dependency using an ASYNCHRONOUS, non-blocking process.
 * Output is streamed to the output channel.
 * Handles sudo requirement on Linux by logging instructions.
 */
async function installDependency(step: ActionStep, outputChannel: vscode.OutputChannel): Promise<void> {
    const { dependency: dep } = step;
    outputChannel.appendLine(`[Executor] Starting install for ${dep.name}...`);

    const platform = process.platform;
    let command: string | undefined;
    let args: string[] = [];
    let requiresSudo = false;
    let installCmdStringForUser: string | undefined;

    // 1. Determine Package Name
    const platformSpecificPackageMap = PACKAGE_NAMES[dep.id as keyof typeof PACKAGE_NAMES];
    let packageName: string | null | undefined = undefined;
    let packageManagerType: string | null = null;

     if (!platformSpecificPackageMap) {
         const errorMsg = `[Executor] ERROR: No configuration found for dependency ID '${dep.id}' in dependencyConfig.ts.`;
         outputChannel.appendLine(errorMsg);
         throw new Error(errorMsg);
    }

    // FIX: Added braces
    if (platform === 'win32' || platform === 'darwin') {
         packageName = platformSpecificPackageMap[platform as keyof typeof platformSpecificPackageMap];
    } else if (platform === 'linux') {
        packageManagerType = detectLinuxPackageManager();
        // FIX: Added braces
        if (packageManagerType) {
            packageName = platformSpecificPackageMap[packageManagerType as keyof typeof platformSpecificPackageMap];
        } else {
             const errorMsg = `[Executor] ERROR: Could not detect supported Linux package manager (apt, dnf, pacman, zypper). Cannot install ${dep.name}.`;
             outputChannel.appendLine(errorMsg);
             throw new Error(errorMsg);
        }
    } else {
         packageName = platformSpecificPackageMap[platform as keyof typeof platformSpecificPackageMap];
         // FIX: Added braces
         if (packageName === undefined) {
             const errorMsg = `[Executor] ERROR: Platform '${platform}' is not explicitly supported for dependency '${dep.id}'.`;
             outputChannel.appendLine(errorMsg);
            throw new Error(errorMsg);
         }
    }

    // FIX: Added braces
    if (packageName === null) {
        outputChannel.appendLine(`[Executor] INFO: Dependency '${dep.name}' requires manual installation or a custom script on this platform (${platform}${packageManagerType ? `/${packageManagerType}`: ''}). Skipping automated install.`);
        return;
    }
     // FIX: Added braces
     if (!packageName) {
         const errorMsg = `[Executor] ERROR: No installation package name found for dependency ID '${dep.id}' on platform '${platform}'. Check dependencyConfig.ts.`;
         outputChannel.appendLine(errorMsg);
         throw new Error(errorMsg);
    }


    // 2. Construct Command
    // FIX: Added braces
    if (platform === 'darwin') {
      command = 'brew';
      args = ['install', packageName];
    } else if (platform === 'win32') {
       try {
           cp.execSync('winget --version', { stdio: 'ignore' });
       } catch (wingetErr) {
            outputChannel.appendLine(`[Executor] ERROR: 'winget' command not found. Please install 'App Installer' from the Microsoft Store.`);
            vscode.window.showErrorMessage(`Winget not found. Please install 'App Installer' from the Microsoft Store.`);
            throw new Error('Winget prerequisite missing.');
       }
      command = 'winget';
      args = ['install', '--id', packageName, '--source', 'winget', '--accept-source-agreements', '--accept-package-agreements', '-e'];
    } else if (platform === 'linux' && packageManagerType) {
        requiresSudo = ['apt', 'dnf', 'pacman', 'zypper'].includes(packageManagerType);
        switch (packageManagerType) {
            case 'apt':
                command = requiresSudo ? 'sudo' : 'apt-get';
                args = requiresSudo ? ['apt-get', 'install', '-y', packageName] : ['install', '-y', packageName];
                installCmdStringForUser = `sudo apt-get install -y ${packageName}`;
                break;
            case 'dnf':
                 command = requiresSudo ? 'sudo' : 'dnf';
                 args = requiresSudo ? ['dnf', 'install', '-y', packageName] : ['install', '-y', packageName];
                 installCmdStringForUser = `sudo dnf install -y ${packageName}`;
                 break;
            case 'pacman':
                 command = requiresSudo ? 'sudo' : 'pacman';
                 args = requiresSudo ? ['pacman', '-S', '--noconfirm', packageName] : ['-S', '--noconfirm', packageName];
                 installCmdStringForUser = `sudo pacman -S --noconfirm ${packageName}`;
                 break;
            case 'zypper':
                 command = requiresSudo ? 'sudo' : 'zypper';
                 args = requiresSudo ? ['zypper', 'install', '-y', packageName] : ['install', '-y', packageName];
                 installCmdStringForUser = `sudo zypper install -y ${packageName}`;
                 break;
            default:
                 const errorMsg = `[Executor] ERROR: Internal error - Unsupported Linux package manager: ${packageManagerType}`;
                 outputChannel.appendLine(errorMsg);
                 throw new Error(errorMsg);
        }

        // FIX: Added braces
        if (requiresSudo) {
             outputChannel.appendLine(`[Executor] ACTION REQUIRED: Installation for '${dep.name}' requires administrator privileges.`);
             outputChannel.appendLine(`  Please run the following command in your terminal:`);
             outputChannel.appendLine(`  ${installCmdStringForUser}`);
             return;
        }
    } else {
         const errorMsg = `[Executor] ERROR: Unsupported or undetermined platform configuration for ${dep.name}.`;
         outputChannel.appendLine(errorMsg);
         throw new Error(errorMsg);
    }

    // FIX: Added braces
    if (!command) {
         const errorMsg = `[Executor] ERROR: Could not determine install command for ${dep.name}.`;
         outputChannel.appendLine(errorMsg);
         throw new Error(errorMsg);
    }

    // 3. Execute Command Async (if not handled by sudo instruction)
    await runCommandAsync(command, args, outputChannel, "install", dep.name);
}


/**
 * Uninstalls a dependency asynchronously using spawn.
 * Handles potential sudo requirements similarly to installDependency.
 */
async function uninstallDependency(step: ActionStep, outputChannel: vscode.OutputChannel): Promise<void> {
  const { dependency: dep } = step;
  outputChannel.appendLine(`[Executor] Attempting uninstall for ${dep.name}...`);

  // FIX: Added braces
  if (!dep.uninstallCommand) {
    outputChannel.appendLine(`[Executor] WARNING: No explicit uninstall command provided for ${dep.name}. Skipping uninstall. Manual removal might be needed.`);
    return;
  }

  const commandParts = dep.uninstallCommand.trim().split(/\s+/);
  // FIX: Added braces
  if (commandParts.length === 0) {
       outputChannel.appendLine(`[Executor] WARNING: Invalid uninstall command for ${dep.name}: "${dep.uninstallCommand}". Skipping.`);
       return;
  }
  const command = commandParts[0];
  const args = commandParts.slice(1);

  const requiresSudo = command === 'sudo' || (process.platform === 'linux' && ['apt-get', 'dnf', 'pacman', 'zypper'].some(pm => dep.uninstallCommand?.includes(pm)));

  // FIX: Added braces
  if (requiresSudo && process.platform === 'linux') {
      let actualCommand = command;
      let actualArgs = args;
      // FIX: Added braces
      if(command === 'sudo') {
          // FIX: Added braces
          if (args.length === 0) {
              outputChannel.appendLine(`[Executor] ERROR: Invalid sudo uninstall command for ${dep.name}: "${dep.uninstallCommand}". Skipping.`);
              throw new Error(`Invalid sudo uninstall command: ${dep.uninstallCommand}`);
          }
          actualCommand = args[0];
          actualArgs = args.slice(1);
      }

      outputChannel.appendLine(`[Executor] ACTION REQUIRED: Uninstall for '${dep.name}' may require administrator privileges.`);
      outputChannel.appendLine(`  Please run the following command manually if needed:`);
      outputChannel.appendLine(`  ${dep.uninstallCommand}`);
      return;
  }

  await runCommandAsync(command, args, outputChannel, "uninstall", dep.name);
}


export async function executePlan(plan: ActionPlan, outputChannel: vscode.OutputChannel): Promise<void> {
  outputChannel.appendLine(`\n[Executor] Starting action plan execution...`);
  for (const step of plan) { // FIX: Added braces (though for loop usually has them)
    outputChannel.appendLine(`\n[Executor] ----- Step: ${step.action} for ${step.dependency.name} -----`);
    outputChannel.appendLine(`[Executor] Reason: ${step.reason}`);

    try {
        switch (step.action) {
          case 'INSTALL':
            await installDependency(step, outputChannel);
            break;
          case 'REINSTALL':
            outputChannel.appendLine(`[Executor] Executing REINSTALL.`);
            try {
                 await uninstallDependency(step, outputChannel);
            } catch (uninstallError: any) {
                 outputChannel.appendLine(`[Executor] WARNING: Uninstall step during REINSTALL failed: ${uninstallError.message}. Attempting install anyway.`);
            }
            await installDependency(step, outputChannel);
            break;
          case 'ALREADY_MET':
            outputChannel.appendLine(`[Executor] Skipping (already met).`);
            break;
          default:
             outputChannel.appendLine(`[Executor] WARNING: Unknown action '${(step as any).action}'. Skipping.`);
        }
         outputChannel.appendLine(`[Executor] ----- Finished Step: ${step.action} for ${step.dependency.name} -----`);
    } catch (error: any) {
         outputChannel.appendLine(`[Executor] ##### FATAL ERROR during ${step.action} of ${step.dependency.name} #####`);
         outputChannel.appendLine(`[Executor] Error: ${error.message}`);
         outputChannel.appendLine(`[Executor] Halting further execution of the plan.`);
         vscode.window.showErrorMessage(`Setup failed during ${step.action} for ${step.dependency.name}: ${error.message}. Check output channel.`);
         throw error;
    }
  }
   outputChannel.appendLine(`\n[Executor] ===== Action plan execution finished successfully. =====\n`);
}