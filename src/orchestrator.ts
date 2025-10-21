// src/orchestrator.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';

import { runAudit } from './SetupRunner/Auditor'; //
import { createActionPlan } from './SetupRunner/Planner'; //
import { executePlan } from './SetupRunner/Executor'; //
// Added ExecutionResult, FailedStepInfo to import, updated SetupResult usage
import { CheckResult, DependencyRequirement, ActionPlan, SetupResult, ExecutionResult, FailedStepInfo } from './types'; //
import { scaffoldProject as scaffoldProjectStub } from './projectScaffold'; //
import { runSetup as runSetupStub } from './setupRunner'; //


export class Orchestrator {
  private output: vscode.OutputChannel; //
  private statusBar: vscode.StatusBarItem; //

  constructor(output: vscode.OutputChannel, statusBar: vscode.StatusBarItem) { //
    this.output = output; //
    this.statusBar = statusBar; //
  }

  public log(msg: string) { //
    const ts = new Date().toISOString(); //
    this.output.appendLine(`[${ts}] ${msg}`); //
  }

  // getDevSetupConfig remains the same
  private getDevSetupConfig(workspaceRoot: string): DependencyRequirement[] | null { //
    const devSetupPath = path.join(workspaceRoot, '.devsetup.json'); //
    if (!fs.existsSync(devSetupPath)) { //
      this.log('No .devsetup.json file found.'); //
      return null; //
    }
    try { //
        const devSetupContent = fs.readFileSync(devSetupPath, 'utf8'); //
        const parsedContent = JSON.parse(devSetupContent); //

        if (!Array.isArray(parsedContent)) { //
            this.log('ERROR: .devsetup.json content is not a valid array.'); //
            vscode.window.showErrorMessage('Failed to parse .devsetup.json: Expected an array.'); //
            return null; //
        }
        if (parsedContent.some(item => typeof item !== 'object' || !item.id || !item.name)) { //
             this.log('ERROR: .devsetup.json contains invalid dependency objects (missing id or name).'); //
              vscode.window.showErrorMessage('Failed to parse .devsetup.json: Invalid dependency objects found (must have id and name).'); //
             return null; //
        }
        this.log(`Successfully parsed ${parsedContent.length} dependencies from .devsetup.json`); //
        return parsedContent as DependencyRequirement[]; //
    } catch (e: any) { //
        this.log(`ERROR: Failed to read or parse .devsetup.json: ${e.message}`); //
        vscode.window.showErrorMessage(`Failed to parse .devsetup.json: ${e.message}`); //
        return null; //
    }
  }

  // runCheckRequirements remains the same
  async runCheckRequirements(workspaceRoot: string): Promise<CheckResult> { //
    this.log(`Running requirements check for ${workspaceRoot}`); //
    const requirements = this.getDevSetupConfig(workspaceRoot); //

    if (requirements === null) { //
       return { ok: false, details: 'Could not read or parse .devsetup.json.' }; //
    }

    if (requirements.length === 0) { //
      return { ok: true, details: 'No dependencies listed in .devsetup.json to check.' }; //
    }

    const auditResults = runAudit(requirements); //
    const missing: string[] = []; //
    const incompatible: string[] = []; //
    let foundButCantParse: string[] = []; //

    for (const result of auditResults) { //
        if (!result.isInstalled) { //
            missing.push(result.dependency.name); //
        } else if (result.dependency.requiredVersion) { //
            if (result.installedVersion && semver.valid(result.installedVersion)) { //
                if (!semver.satisfies(result.installedVersion, result.dependency.requiredVersion)) { //
                    incompatible.push(`${result.dependency.name} (Installed: ${result.installedVersion}, Required: ${result.dependency.requiredVersion})`); //
                }
            } else { //
                foundButCantParse.push(`${result.dependency.name} (Installed version '${result.installedVersion || 'unknown'}' could not be parsed. Required: ${result.dependency.requiredVersion})`); //
            }
        }
    }


    if (missing.length > 0 || incompatible.length > 0 || foundButCantParse.length > 0) { //
        let details = ''; //
        if (missing.length > 0) { details += `Missing: ${missing.join(', ')}. `; } //
        if (incompatible.length > 0) { details += `Incompatible: ${incompatible.join(', ')}. `; } //
        if (foundButCantParse.length > 0) { details += `Version Unknown/Incompatible: ${foundButCantParse.join(', ')}. `; } //
        return { ok: false, details: details.trim(), missing }; //
    }

    return { ok: true, details: 'All required dependencies are installed and compatible.' }; //
  }


  /**
   * The full flow: Audit -> Plan -> Execute -> Scaffold -> Final Setup
   * Returns SetupResult indicating overall status, including partial success and failures.
   */
  async runFullValidationAndSetup(workspaceRoot: string, token?: vscode.CancellationToken): Promise<SetupResult> { //
    this.statusBar.text = '$(sync~spin) GeckoPilot: Running setup...'; //
    this.statusBar.show(); //
    this.log(`Starting full validation and setup for workspace: ${workspaceRoot}`); //

    let executionResult: ExecutionResult | null = null; //
    let setupSucceeded = false; // Track overall success

    try { //
      const requirements = this.getDevSetupConfig(workspaceRoot); //
      if (requirements === null) { //
          this.statusBar.text = '$(error) GeckoPilot: Error'; //
          return { success: false, message: 'Invalid or missing .devsetup.json.' }; //
      }

      if (requirements.length === 0) { //
        vscode.window.showInformationMessage('No dependencies listed in .devsetup.json. Nothing to install/check.'); //
         this.log('No dependencies found, proceeding to scaffold.'); //
         executionResult = { totalSteps: 0, stepsAttempted: 0, stepsSucceeded: 0, stepsSkippedSudo: 0, stepsFailed: 0, manualSudoCommands: [], failedStepsInfo: [] }; //
      } else { //
          // 1. Audit
          this.log('Auditing dependencies...'); //
          const auditResults = runAudit(requirements); //

          if (token?.isCancellationRequested) { this.log('Operation cancelled by user after audit.'); throw new Error('Operation cancelled.'); } //

          // 2. Plan
          this.log('Creating an action plan...'); //
          const actionPlan: ActionPlan = createActionPlan(auditResults); //
          const stepsToDo = actionPlan.filter(step => step.action !== 'ALREADY_MET'); //

          if (stepsToDo.length > 0) { //
            this.log(`Executing plan: ${stepsToDo.length} action(s) required.`); //
            // Execute plan BUT DO NOT THROW on individual step failures here
            executionResult = await executePlan(actionPlan, this.output); //
            this.log('Dependency action plan execution finished.'); //
          } else { //
            this.log('All dependencies are already installed and meet requirements.'); //
             executionResult = { totalSteps: actionPlan.length, stepsAttempted: 0, stepsSucceeded: 0, stepsSkippedSudo: 0, stepsFailed: 0, manualSudoCommands: [], failedStepsInfo: [] }; //
          }
      }

       if (token?.isCancellationRequested) { this.log('Operation cancelled by user after dependency execution.'); throw new Error('Operation cancelled.'); } //

        // --- Check Execution Result BEFORE Scaffolding ---
        if (!executionResult) { //
             this.statusBar.text = '$(error) GeckoPilot: Internal Error'; //
            throw new Error("Internal Error: Execution result not available."); //
        }

        // --- MODIFIED: Decide whether to continue if deps failed ---
        if (executionResult.stepsFailed > 0) {
             this.log(`Dependency installation failed for ${executionResult.stepsFailed} item(s). Aborting scaffold and final setup.`);
             this.statusBar.text = '$(error) GeckoPilot: Dependency Failed';
             const failedNames = executionResult.failedStepsInfo.map(f => f.dependencyName).join(', ');
             const message = `Dependency installation failed for: ${failedNames}. Setup cannot continue. Check output channel for details.`;
             vscode.window.showErrorMessage(message); // Show error summarizing failures
             // Return failure status
             return { success: false, message: message, failedSteps: executionResult.failedStepsInfo };
        }
        // --- END MODIFICATION ---


      // 4. Scaffold (Using the stub) - Only runs if no dependency steps hard-failed
      this.log('Scaffolding project...'); //
      const scaffoldResult = await scaffoldProjectStub(workspaceRoot, {}, (msg: string) => { //
        this.log(`[scaffold] ${msg}`); //
      }); //
      if (!scaffoldResult.success) { //
        this.log(`Scaffolding failed: ${scaffoldResult.message}`); //
        vscode.window.showErrorMessage(`Scaffolding failed: ${scaffoldResult.message}`); //
         this.statusBar.text = '$(error) GeckoPilot: Scaffold Failed'; //
        return { success: false, message: `Scaffolding failed: ${scaffoldResult.message}`, failedSteps: executionResult.failedStepsInfo }; // Include dep failures if any
      }
      this.log('Scaffolding complete.'); //

      if (token?.isCancellationRequested) { this.log('Operation cancelled by user after scaffold.'); throw new Error('Operation cancelled.'); } //

      // 5. Run Setup (Using the stub) - Only runs if deps & scaffold succeeded
      this.log('Running final setup steps...'); //
       const finalSetupResult = await runSetupStub(workspaceRoot, {}, (msg: string) => { //
           this.log(`[setup] ${msg}`); //
       }); //
       if (!finalSetupResult.success) { //
           this.log(`Final setup failed: ${finalSetupResult.message}`); //
           vscode.window.showErrorMessage(`Final setup failed: ${finalSetupResult.message}`); //
            this.statusBar.text = '$(error) GeckoPilot: Setup Failed'; //
           return { success: false, message: `Final setup failed: ${finalSetupResult.message}`, failedSteps: executionResult.failedStepsInfo }; // Include dep failures
       }
       this.log('Final setup complete.'); //

       setupSucceeded = true; // Mark overall success if we reach here

        // --- Determine Final Status and Message ---
        // (This logic now runs only if no hard failures occurred in deps, scaffold, or final setup)
        if (executionResult.stepsSkippedSudo > 0) { //
             const manualCmdList = executionResult.manualSudoCommands.map(cmd => `\`${cmd}\``).join(', '); //
             const manualNeededCount = executionResult.manualSudoCommands.length; //

             const message = `Setup partially complete. ${executionResult.stepsSucceeded} dependencies handled automatically. ${manualNeededCount} step(s) require manual action (check terminal/output): ${manualCmdList || 'Details in output channel'}. Scaffold and final setup steps completed.`; //
             this.log(`Partial Success: ${message}`); //
             vscode.window.showWarningMessage(message, { modal: false }); //
             this.statusBar.text = '$(warning) GeckoPilot: Manual Steps Needed'; //
             // Return partial success status
             return { success: false, partialSuccess: true, message: message, manualStepsRequired: executionResult.manualSudoCommands, failedSteps: [] };
        } else { //
             // Full success message
             const message = `✅ Workspace setup complete! ${executionResult.stepsSucceeded} dependencies verified/installed. Scaffold and final setup steps also completed.`; //
             this.log(`Full Success: ${message}`); //
             vscode.window.showInformationMessage(message); //
             this.statusBar.text = '$(check) GeckoPilot: Ready'; //
             return { success: true, message: 'Setup finished successfully.' }; //
        }


    } catch (err: any) { //
        // Handle cancellation or errors re-thrown by Executor/Stubs
        const errorMessage = (err instanceof Error) ? err.message : String(err); //
        this.log(`Full setup flow failed: ${errorMessage}`); //

        if (errorMessage === 'Operation cancelled.') { //
            vscode.window.showInformationMessage('GeckoPilot setup cancelled.'); //
             this.statusBar.text = '$(info) GeckoPilot: Cancelled'; //
        } else { //
             // Error message should have been shown closer to the source (e.g., Executor or the explicit check above)
             // Only show a generic one if something else unexpected happened
            if (!errorMessage.includes('Setup failed during') && !errorMessage.toLowerCase().includes('winget') && !errorMessage.includes('Setup cannot continue')) { //
                 vscode.window.showErrorMessage(`GeckoPilot setup encountered an error: ${errorMessage}`); //
            }
             this.statusBar.text = '$(error) GeckoPilot: Error'; //
        }
        // Return failure, including failed step info if available from executionResult
        return { success: false, message: errorMessage, failedSteps: executionResult?.failedStepsInfo || [] }; //
    } finally { //
      const hideDelay = setupSucceeded ? 5000 : 15000; // Keep status bar visible longer on failure/partial success
      setTimeout(() => { //
          if (this.statusBar && this.statusBar.text !== '$(sync~spin) GeckoPilot: Running setup...') { //
              try { this.statusBar.hide(); } catch { /* ignore */ } //
          }
      }, hideDelay); //
    }
  }
} //