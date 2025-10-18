// src/orchestrator.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver'; // Import semver

// Import the necessary functions and types from the SetupRunner modules
import { runAudit } from './SetupRunner/Auditor';
import { createActionPlan } from './SetupRunner/Planner';
import { executePlan } from './SetupRunner/Executor';
import { CheckResult, DependencyRequirement, ActionPlan, SetupResult } from './types';
import { scaffoldProject as scaffoldProjectStub } from './projectScaffold';
import { runSetup as runSetupStub } from './setupRunner';

export class Orchestrator {
  private output: vscode.OutputChannel;
  private statusBar: vscode.StatusBarItem;

  constructor(output: vscode.OutputChannel, statusBar: vscode.StatusBarItem) {
    this.output = output;
    this.statusBar = statusBar;
  }

  private log(msg: string) {
    const ts = new Date().toISOString();
    this.output.appendLine(`[${ts}] ${msg}`);
  }

  /**
   * Reads the .devsetup.json file and returns the parsed content.
   */
  private getDevSetupConfig(workspaceRoot: string): DependencyRequirement[] | null {
    const devSetupPath = path.join(workspaceRoot, '.devsetup.json');
    if (!fs.existsSync(devSetupPath)) {
      this.log('No .devsetup.json file found.');
      return null;
    }
    try {
        const devSetupContent = fs.readFileSync(devSetupPath, 'utf8');
        const parsedContent = JSON.parse(devSetupContent);

        if (!Array.isArray(parsedContent)) {
            this.log('ERROR: .devsetup.json content is not a valid array.');
            vscode.window.showErrorMessage('Failed to parse .devsetup.json: Expected an array.');
            return null;
        }
        // Basic validation of array items
        if (parsedContent.some(item => typeof item !== 'object' || !item.id || !item.name)) {
             this.log('ERROR: .devsetup.json contains invalid dependency objects (missing id or name).');
              vscode.window.showErrorMessage('Failed to parse .devsetup.json: Invalid dependency objects found.');
             return null;
        }
        return parsedContent as DependencyRequirement[];
    } catch (e: any) {
        this.log(`ERROR: Failed to read or parse .devsetup.json: ${e.message}`);
        vscode.window.showErrorMessage(`Failed to parse .devsetup.json: ${e.message}`);
        return null;
    }
  }

   /**
   * Runs only the requirement check and reports the status.
   * Uses the SetupRunner/Auditor and semver.
   */
  async runCheckRequirements(workspaceRoot: string): Promise<CheckResult> {
    this.log(`Running requirements check for ${workspaceRoot}`);
    const requirements = this.getDevSetupConfig(workspaceRoot);

    if (requirements === null) {
       return { ok: false, details: 'Could not read or parse .devsetup.json.' };
    }
    
    if (requirements.length === 0) {
      return { ok: true, details: 'No dependencies listed in .devsetup.json to check.' };
    }

    const auditResults = runAudit(requirements);
    const missing: string[] = [];
    const incompatible: string[] = [];

    for (const result of auditResults) {
        if (!result.isInstalled) {
            missing.push(result.dependency.name);
        } else if (result.dependency.requiredVersion && result.installedVersion) {
            // FIX: Use semver.satisfies for accurate version check
            if (!semver.satisfies(result.installedVersion, result.dependency.requiredVersion)) {
                incompatible.push(`${result.dependency.name} (Installed: ${result.installedVersion}, Required: ${result.dependency.requiredVersion})`);
            }
        }
         // If installedVersion is null/undefined but requiredVersion exists, consider it potentially incompatible or audit failed?
         // Current Auditor returns raw output if parsing fails, semver.satisfies handles non-semver strings gracefully (returns false)
         else if (result.dependency.requiredVersion && !result.installedVersion) {
              incompatible.push(`${result.dependency.name} (Installed version could not be determined, Required: ${result.dependency.requiredVersion})`);
         }
    }


    if (missing.length > 0 || incompatible.length > 0) {
        let details = '';
        if (missing.length > 0) details += `Missing dependencies: ${missing.join(', ')}. `;
        if (incompatible.length > 0) details += `Incompatible versions: ${incompatible.join(', ')}.`;
        return { ok: false, details: details.trim(), missing };
    }

    return { ok: true, details: 'All required dependencies are installed and compatible.' };
  }


  /**
   * The full flow: Audit -> Plan -> Execute -> Scaffold -> Final Setup
   */
  async runFullValidationAndSetup(workspaceRoot: string, token?: vscode.CancellationToken): Promise<SetupResult> {
    this.statusBar.text = 'Dev Orchestrator: Running setup...';
    this.statusBar.show();

    try {
      const requirements = this.getDevSetupConfig(workspaceRoot);
      if (requirements === null) {
          vscode.window.showErrorMessage('Failed to read or parse .devsetup.json. Setup cannot proceed.');
          return { success: false, message: 'Invalid or missing .devsetup.json.' };
      }
      if (requirements.length === 0) {
        vscode.window.showInformationMessage('No dependencies listed in .devsetup.json. Nothing to install.');
         this.log('No dependencies found, proceeding to scaffold.');
      } else {
          // 1. Audit
          this.log('Auditing dependencies...');
          const auditResults = runAudit(requirements);

          if (token?.isCancellationRequested) { this.log('Operation cancelled by user after audit.'); return { success: false, message: 'Operation cancelled.' }; }

          // 2. Plan
          this.log('Creating an action plan...');
          const actionPlan: ActionPlan = createActionPlan(auditResults);
          const stepsToDo = actionPlan.filter(step => step.action !== 'ALREADY_MET');

          if (stepsToDo.length > 0) {
            this.log(`Executing plan: ${stepsToDo.length} action(s) required.`);
            await executePlan(actionPlan, this.output); // executePlan is now async
            this.log('Dependency action plan execution finished.');
          } else {
            this.log('All dependencies are already installed and meet requirements.');
          }
      }

       if (token?.isCancellationRequested) { this.log('Operation cancelled by user after execution.'); return { success: false, message: 'Operation cancelled.' }; }

      // 4. Scaffold (Using the stub)
      this.log('Scaffolding project...');
      const scaffoldResult = await scaffoldProjectStub(workspaceRoot, {}, (msg: string) => {
        this.log(`[scaffold] ${msg}`);
      });
      if (!scaffoldResult.success) {
        // No need to throw, just return the failure
        this.log(`Scaffolding failed: ${scaffoldResult.message}`);
        vscode.window.showErrorMessage(`Scaffolding failed: ${scaffoldResult.message}`);
        return { success: false, message: `Scaffolding failed: ${scaffoldResult.message}` };
      }
      this.log('Scaffolding complete.');

      if (token?.isCancellationRequested) { this.log('Operation cancelled by user after scaffold.'); return { success: false, message: 'Operation cancelled.' }; }

      // 5. Run Setup (Using the stub)
      this.log('Running final setup steps...');
       const setupResult = await runSetupStub(workspaceRoot, {}, (msg: string) => {
           this.log(`[setup] ${msg}`);
       });
       if (!setupResult.success) {
           this.log(`Final setup failed: ${setupResult.message}`);
           vscode.window.showErrorMessage(`Final setup failed: ${setupResult.message}`);
           return { success: false, message: `Final setup failed: ${setupResult.message}` };
       }
       this.log('Final setup complete.');

      vscode.window.showInformationMessage('✅ Workspace setup complete!');
      this.statusBar.text = 'Dev Orchestrator: Ready';
      return { success: true, message: 'Setup finished successfully.' };

    } catch (err: any) {
        // Errors thrown by executePlan or other steps land here
        this.log(`Full flow failed: ${err.message}`);
        // Error message already shown by executePlan or runCheckRequirements etc. if they throw
        // Only show a generic one if the error originated elsewhere.
        if (!String(err.message).includes('Installation failed') && !String(err.message).includes('Reinstallation failed')) {
            vscode.window.showErrorMessage(`Orchestration failed unexpectedly: ${err.message}`);
        }
        this.statusBar.text = 'Dev Orchestrator: Error';
        return { success: false, message: err.message };
    } finally {
      setTimeout(() => { try { this.statusBar.hide(); } catch { /* ignore */ } }, 5000); // Show status briefly
    }
  }
}