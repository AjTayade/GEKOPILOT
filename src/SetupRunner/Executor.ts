// src/SetupRunner/Executor.ts

import * as cp from "child_process";
import { spawn } from "child_process";
import * as vscode from "vscode";
import * as fs from 'fs';
// Added FailedStepInfo to import
import { ActionPlan, ActionStep, DependencyRequirement, ExecutionResult, FailedStepInfo } from "../types"; //
import { PACKAGE_NAMES } from "./dependencyConfig"; //

// detectLinuxPackageManager remains the same
function detectLinuxPackageManager(): 'apt' | 'dnf' | 'pacman' | 'zypper' | null { //
    const pathsToCheck = ['/usr/bin/', '/bin/', '/usr/sbin/', '/sbin/']; //
    for (const p of pathsToCheck) { //
        if (fs.existsSync(`${p}apt-get`)) { return 'apt'; } //
        if (fs.existsSync(`${p}dnf`)) { return 'dnf'; } //
        if (fs.existsSync(`${p}pacman`)) { return 'pacman'; } //
        if (fs.existsSync(`${p}zypper`)) { return 'zypper'; } //
    }
     try { //
        if (process.platform === 'win32') { //
            cp.execSync('where apt-get', { stdio: 'ignore' }); return 'apt'; //
        } else { //
            cp.execSync('which apt-get', { stdio: 'ignore' }); return 'apt'; //
        }
     } catch {} //
     try { //
         if (process.platform === 'win32') { //
             cp.execSync('where dnf', { stdio: 'ignore' }); return 'dnf'; //
         } else { //
             cp.execSync('which dnf', { stdio: 'ignore' }); return 'dnf'; //
         }
     } catch {} //
     try { //
          if (process.platform === 'win32') { //
             cp.execSync('where pacman', { stdio: 'ignore' }); return 'pacman'; //
         } else { //
             cp.execSync('which pacman', { stdio: 'ignore' }); return 'pacman'; //
         }
     } catch {} //
      try { //
          if (process.platform === 'win32') { //
             cp.execSync('where zypper', { stdio: 'ignore' }); return 'zypper'; //
         } else { //
             cp.execSync('which zypper', { stdio: 'ignore' }); return 'zypper'; //
         }
     } catch {} //
    return null; //
}


// runCommandAsync remains the same
function runCommandAsync( //
    command: string, //
    args: string[], //
    outputChannel: vscode.OutputChannel, //
    operationName: string, //
    dependencyName: string //
): Promise<void> { //
    return new Promise((resolve, reject) => { //
        outputChannel.appendLine(`[Executor] Running: ${command} ${args.join(' ')}`); //
        try { //
            const child = spawn(command, args, { //
                stdio: ['pipe', 'pipe', 'pipe'], //
                shell: process.platform === 'win32' //
            }); //

            child.stdout?.on('data', (data) => { //
                outputChannel.appendLine(data.toString().trim()); //
            }); //

            child.stderr?.on('data', (data) => { //
                const stdErrLine = data.toString().trim(); //
                const prefix = stdErrLine.toLowerCase().includes('error') ? '[STDERR/ERROR]' : '[STDERR]'; //
                outputChannel.appendLine(`${prefix} ${stdErrLine}`); //
            }); //

            child.on('error', (err) => { //
                outputChannel.appendLine(`[Executor] ERROR: Failed to start ${operationName} process for ${dependencyName}: ${err.message}`); //
                reject(err); //
            }); //

            child.on('close', (code) => { //
                if (code === 0) { //
                    outputChannel.appendLine(`[Executor] Successfully finished ${operationName} for ${dependencyName}.`); //
                    resolve(); //
                } else { //
                    const errorMsg = `[Executor] ERROR: ${operationName} process for ${dependencyName} exited with code ${code}. Check output above.`; //
                    outputChannel.appendLine(errorMsg); //
                    reject(new Error(errorMsg)); //
                }
            }); //
        } catch (spawnError: any) { //
            outputChannel.appendLine(`[Executor] ERROR: Failed to spawn ${operationName} process for ${dependencyName}: ${spawnError.message}`); //
            reject(spawnError); //
        }
    }); //
}


// getSudoTerminal remains the same
function getSudoTerminal(): vscode.Terminal { //
    const existingTerminal = vscode.window.terminals.find(t => t.name === 'GeckoPilot Sudo Runner'); //
    if (existingTerminal) { //
        return existingTerminal; //
    }
    return vscode.window.createTerminal('GeckoPilot Sudo Runner'); //
}


// installDependency remains the same
async function installDependency(step: ActionStep, outputChannel: vscode.OutputChannel): Promise<{ requiresSudo: boolean, command: string | null }> { //
    const { dependency: dep } = step; //
    outputChannel.appendLine(`[Executor] Starting install for ${dep.name}...`); //

    const platform = process.platform; //
    let command: string | undefined; //
    let args: string[] = []; //
    let requiresSudo = false; //
    let fullSudoCommandForUser: string | undefined; //

    // 1. Determine Package Name
    const platformSpecificPackageMap = PACKAGE_NAMES[dep.id as keyof typeof PACKAGE_NAMES]; //
    let packageName: string | null | undefined = undefined; //
    let packageManagerType: string | null = null; //

     if (!platformSpecificPackageMap) { //
         const errorMsg = `[Executor] ERROR: No configuration found for dependency ID '${dep.id}' in dependencyConfig.ts.`; //
         outputChannel.appendLine(errorMsg); //
         throw new Error(errorMsg); //
    }

    if (platform === 'win32' || platform === 'darwin') { //
         packageName = platformSpecificPackageMap[platform as keyof typeof platformSpecificPackageMap]; //
    } else if (platform === 'linux') { //
        packageManagerType = detectLinuxPackageManager(); //
        if (packageManagerType) { //
            packageName = platformSpecificPackageMap[packageManagerType as keyof typeof platformSpecificPackageMap]; //
        } else { //
             const errorMsg = `[Executor] ERROR: Could not detect supported Linux package manager (apt, dnf, pacman, zypper). Cannot install ${dep.name}.`; //
             outputChannel.appendLine(errorMsg); //
             throw new Error(errorMsg); //
        }
    } else { //
         packageName = platformSpecificPackageMap[platform as keyof typeof platformSpecificPackageMap]; //
         if (packageName === undefined) { //
             const errorMsg = `[Executor] ERROR: Platform '${platform}' is not explicitly supported for dependency '${dep.id}'.`; //
             outputChannel.appendLine(errorMsg); //
            throw new Error(errorMsg); //
         }
    }

    if (packageName === null) { //
        outputChannel.appendLine(`[Executor] INFO: Dependency '${dep.name}' requires manual installation or a custom script on this platform (${platform}${packageManagerType ? `/${packageManagerType}`: ''}). Skipping automated install.`); //
        return { requiresSudo: true, command: `Manual installation needed for ${dep.name}` }; //
    }
     if (!packageName) { //
         const errorMsg = `[Executor] ERROR: No installation package name found for dependency ID '${dep.id}' on platform '${platform}'. Check dependencyConfig.ts.`; //
         outputChannel.appendLine(errorMsg); //
         throw new Error(errorMsg); //
    }


    // 2. Construct Command
    if (platform === 'darwin') { //
      command = 'brew'; //
      args = ['install', packageName]; //
    } else if (platform === 'win32') { //
       try { //
           cp.execSync('winget --version', { stdio: 'ignore' }); //
       } catch (wingetErr) { //
            outputChannel.appendLine(`[Executor] ERROR: 'winget' command not found. Please install 'App Installer' from the Microsoft Store.`); //
            vscode.window.showErrorMessage(`Winget not found. Please install 'App Installer' from the Microsoft Store.`); //
            throw new Error('Winget prerequisite missing.'); //
       }
      command = 'winget'; //
      args = ['install', '--id', packageName, '--source', 'winget', '--accept-source-agreements', '--accept-package-agreements', '-e', '--force']; //
    } else if (platform === 'linux' && packageManagerType) { //
        requiresSudo = true; //
        switch (packageManagerType) { //
            case 'apt': //
                command = 'sudo'; //
                args = ['apt-get', 'install', '-y', packageName]; //
                break; //
            case 'dnf': //
                 command = 'sudo'; //
                 args = ['dnf', 'install', '-y', packageName]; //
                 break; //
            case 'pacman': //
                 command = 'sudo'; //
                 args = ['pacman', '-S', '--noconfirm', packageName]; //
                 break; //
            case 'zypper': //
                 command = 'sudo'; //
                 args = ['zypper', 'install', '-y', packageName]; //
                 break; //
            default: //
                 const errorMsg = `[Executor] ERROR: Internal error - Unsupported Linux package manager: ${packageManagerType}`; //
                 outputChannel.appendLine(errorMsg); //
                 throw new Error(errorMsg); //
        }
        fullSudoCommandForUser = `${command} ${args.join(' ')}`; //
    } else { //
         const errorMsg = `[Executor] ERROR: Unsupported or undetermined platform configuration for ${dep.name}.`; //
         outputChannel.appendLine(errorMsg); //
         throw new Error(errorMsg); //
    }

    if (!command) { //
         const errorMsg = `[Executor] ERROR: Could not determine install command for ${dep.name}.`; //
         outputChannel.appendLine(errorMsg); //
         throw new Error(errorMsg); //
    }

    // 3. Execute Command or Prompt for Sudo
    if (requiresSudo && fullSudoCommandForUser) { //
        outputChannel.appendLine(`[Executor] ACTION REQUIRED: Installation for '${dep.name}' requires administrator privileges.`); //
        outputChannel.appendLine(`  Running in dedicated terminal: ${fullSudoCommandForUser}`); //

        const sudoTerminal = getSudoTerminal(); //
        sudoTerminal.sendText(fullSudoCommandForUser); //
        sudoTerminal.show(); //

        await vscode.window.showInformationMessage( //
            `GeckoPilot needs administrator privileges to install '${dep.name}'.\n\nPlease check the 'GeckoPilot Sudo Runner' terminal (it should be visible now), enter your password if prompted, and wait for the command to complete.\n\nClick OK only when the installation in the terminal finishes.`, //
            { modal: true } //
        ); //
        outputChannel.appendLine(`[Executor] User acknowledged sudo prompt for ${dep.name}. Assuming step completed manually.`); //
        return { requiresSudo: true, command: fullSudoCommandForUser }; //

    } else { //
        try { //
            await runCommandAsync(command, args, outputChannel, step.action === 'REINSTALL' ? 'reinstall' : 'install', dep.name); //
            return { requiresSudo: false, command: null }; //
        } catch (error) { //
            throw error; //
        }
    }
}


// uninstallDependency remains the same
async function uninstallDependency(step: ActionStep, outputChannel: vscode.OutputChannel): Promise<{ requiresSudo: boolean, command: string | null }> { //
    const { dependency: dep } = step; //
    outputChannel.appendLine(`[Executor] Attempting uninstall for ${dep.name}...`); //

    const platform = process.platform; //
    let packageName: string | null | undefined = undefined; //
    let packageManagerType: string | null = null; //
    const platformSpecificPackageMap = PACKAGE_NAMES[dep.id as keyof typeof PACKAGE_NAMES]; //

    if (!platformSpecificPackageMap) { //
        outputChannel.appendLine(`[Executor] WARNING: No configuration found for dependency ID '${dep.id}'. Cannot determine package name for uninstall. Skipping.`); //
        return { requiresSudo: false, command: null }; //
    }
     if (platform === 'win32' || platform === 'darwin') { //
         packageName = platformSpecificPackageMap[platform as keyof typeof platformSpecificPackageMap]; //
    } else if (platform === 'linux') { //
        packageManagerType = detectLinuxPackageManager(); //
        if (packageManagerType) { //
            packageName = platformSpecificPackageMap[packageManagerType as keyof typeof platformSpecificPackageMap]; //
        }
    } else { //
        packageName = platformSpecificPackageMap[platform as keyof typeof platformSpecificPackageMap]; //
        if (packageName === undefined) { //
             outputChannel.appendLine(`[Executor] WARNING: Platform '${platform}' is not explicitly supported for uninstalling '${dep.id}'. Skipping.`); //
             return { requiresSudo: false, command: null }; //
        }
    }
     if (packageName === null) { //
        outputChannel.appendLine(`[Executor] INFO: Dependency '${dep.name}' requires manual removal on this platform. Skipping automated uninstall.`); //
         return { requiresSudo: true, command: `Manual removal needed for ${dep.name}` }; //
    }
     if (!packageName) { //
         outputChannel.appendLine(`[Executor] WARNING: No uninstall package name found for dependency ID '${dep.id}' on platform '${platform}'. Skipping uninstall.`); //
         return { requiresSudo: false, command: null }; //
    }

    let command: string | undefined; //
    let args: string[] = []; //
    let requiresSudo = false; //
    let fullSudoCommandForUser: string | undefined; //

    if (platform === 'darwin') { //
        command = 'brew'; //
        args = ['uninstall', packageName]; //
    } else if (platform === 'win32') { //
        command = 'winget'; //
        args = ['uninstall', '--id', packageName, '--source', 'winget', '--accept-source-agreements', '-e']; //
    } else if (platform === 'linux' && packageManagerType) { //
        requiresSudo = true; //
        switch (packageManagerType) { //
            case 'apt': command = 'sudo'; args = ['apt-get', 'remove', '-y', packageName]; break; //
            case 'dnf': command = 'sudo'; args = ['dnf', 'remove', '-y', packageName]; break; //
            case 'pacman': command = 'sudo'; args = ['pacman', '-Rns', '--noconfirm', packageName]; break; //
            case 'zypper': command = 'sudo'; args = ['zypper', 'remove', '-y', packageName]; break; //
            default: outputChannel.appendLine(`[Executor] ERROR: Internal error - Unsupported Linux package manager: ${packageManagerType}. Skipping uninstall.`); return { requiresSudo: false, command: null }; //
        }
        fullSudoCommandForUser = `${command} ${args.join(' ')}`; //
    } else { //
         outputChannel.appendLine(`[Executor] WARNING: Cannot determine uninstall command for ${dep.name} on this platform. Skipping.`); //
         return { requiresSudo: false, command: null }; //
    }

    if (requiresSudo && fullSudoCommandForUser) { //
        outputChannel.appendLine(`[Executor] ACTION REQUIRED: Uninstall for '${dep.name}' requires administrator privileges.`); //
        outputChannel.appendLine(`  Running in dedicated terminal: ${fullSudoCommandForUser}`); //

        const sudoTerminal = getSudoTerminal(); //
        sudoTerminal.sendText(fullSudoCommandForUser); //
        sudoTerminal.show(); //

        await vscode.window.showInformationMessage( //
            `GeckoPilot needs administrator privileges to uninstall '${dep.name}'.\n\nPlease check the 'GeckoPilot Sudo Runner' terminal, enter your password if prompted, and wait for the command to complete.\n\nClick OK only when the uninstallation finishes.`, //
            { modal: true } //
        ); //
        outputChannel.appendLine(`[Executor] User acknowledged sudo prompt for uninstalling ${dep.name}. Assuming step completed manually.`); //
        return { requiresSudo: true, command: fullSudoCommandForUser }; //
    } else if (command) { //
        try { //
            await runCommandAsync(command, args, outputChannel, "uninstall", dep.name); //
            return { requiresSudo: false, command: null }; //
        } catch (error: any) { //
            outputChannel.appendLine(`[Executor] WARNING: Failed during automatic uninstall of ${dep.name}: ${error.message}. Continuing...`); //
            return { requiresSudo: false, command: null }; //
        }
    } else { //
        outputChannel.appendLine(`[Executor] WARNING: Could not determine non-sudo uninstall command for ${dep.name}. Skipping.`); //
        return { requiresSudo: false, command: null }; //
    }
}


/**
 * Executes the plan, modified to return ExecutionResult and continue on step failure.
 */
export async function executePlan(plan: ActionPlan, outputChannel: vscode.OutputChannel): Promise<ExecutionResult> {
    outputChannel.appendLine(`\n[Executor] Starting action plan execution...`);
    const result: ExecutionResult = {
        totalSteps: plan.length,
        stepsAttempted: 0,
        stepsSucceeded: 0,
        stepsSkippedSudo: 0,
        stepsFailed: 0,
        manualSudoCommands: [],
        failedStepsInfo: [], // Initialize new field
    };

    for (const step of plan) {
        if (step.action === 'ALREADY_MET') { //
            outputChannel.appendLine(`\n[Executor] ----- Step: ${step.action} for ${step.dependency.name} -----`); //
            outputChannel.appendLine(`[Executor] Reason: ${step.reason}`); //
            outputChannel.appendLine(`[Executor] Skipping (already met).`); //
            outputChannel.appendLine(`[Executor] ----- Finished Step: ${step.action} for ${step.dependency.name} -----`); //
            continue; //
        }

        outputChannel.appendLine(`\n[Executor] ----- Step: ${step.action} for ${step.dependency.name} -----`); //
        outputChannel.appendLine(`[Executor] Reason: ${step.reason}`); //
        result.stepsAttempted++;

        try { //
            let installResult = { requiresSudo: false, command: null as string | null }; //
            let uninstallResult = { requiresSudo: false, command: null as string | null }; //

            switch (step.action) { //
                case 'INSTALL': //
                    installResult = await installDependency(step, outputChannel); //
                    if (installResult.requiresSudo) { //
                        result.stepsSkippedSudo++;
                        if (installResult.command) {result.manualSudoCommands.push(installResult.command); }//
                    } else { //
                        result.stepsSucceeded++;
                    }
                    break; //
                case 'REINSTALL': //
                    outputChannel.appendLine(`[Executor] Executing REINSTALL.`); //
                    // Try uninstall first. Record if sudo was needed. Failure is logged but doesn't stop.
                    uninstallResult = await uninstallDependency(step, outputChannel); //
                    if (uninstallResult.requiresSudo && uninstallResult.command && !result.manualSudoCommands.includes(uninstallResult.command)) { //
                         result.manualSudoCommands.push(uninstallResult.command); //
                    }

                    // Then install
                    installResult = await installDependency(step, outputChannel); //
                     if (installResult.requiresSudo) { //
                        result.stepsSkippedSudo++;
                        if (installResult.command && !result.manualSudoCommands.includes(installResult.command)) { //
                            result.manualSudoCommands.push(installResult.command); //
                        }
                    } else { //
                        result.stepsSucceeded++;
                    }
                    break; //
                default: //
                    outputChannel.appendLine(`[Executor] WARNING: Unknown action '${(step as any).action}'. Skipping.`); //
            }
            outputChannel.appendLine(`[Executor] ----- Finished Step: ${step.action} for ${step.dependency.name} -----`); //
        } catch (error: any) { //
            // --- MODIFIED ERROR HANDLING ---
            const errorMessage = (error instanceof Error) ? error.message : String(error);
            outputChannel.appendLine(`[Executor] ##### ERROR during ${step.action} of ${step.dependency.name} #####`); //
            outputChannel.appendLine(`[Executor] Error: ${errorMessage}`); //
            result.stepsFailed++;
            result.failedStepsInfo.push({
                dependencyName: step.dependency.name,
                action: step.action as "INSTALL" | "REINSTALL", // Cast needed
                errorMessage: errorMessage
            });
            // Show message but DO NOT re-throw the error
            vscode.window.showErrorMessage(`Setup failed for ${step.dependency.name}: ${errorMessage}. Check output channel. Continuing...`); //
            outputChannel.appendLine(`[Executor] Continuing to next step despite error.`); //
            // Use 'continue' to move to the next iteration of the loop
            continue;
            // --- END MODIFIED ERROR HANDLING ---
        }
    }

    // Filter out generic "Manual..." messages from the command list shown to the user
    result.manualSudoCommands = result.manualSudoCommands.filter(cmd => !cmd.startsWith("Manual")); //

    const summaryMsg = `\n[Executor] ===== Action plan execution finished. Summary: TotalSteps=${result.totalSteps}, Attempted=${result.stepsAttempted}, Succeeded=${result.stepsSucceeded}, ManualSudo=${result.stepsSkippedSudo}, Failed=${result.stepsFailed} =====\n`; //
    outputChannel.appendLine(summaryMsg); //
    return result; //
}