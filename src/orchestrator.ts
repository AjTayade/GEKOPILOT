// src/orchestrator.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Import the necessary functions and types from the SetupRunner modules
import { runAudit } from './SetupRunner/Auditor';
import { createActionPlan } from './SetupRunner/Planner';
import { executePlan } from './SetupRunner/Executor';
import { CheckResult, DependencyRequirement, ActionPlan } from './types';
import { scaffoldProject } from './projectScaffold';

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
  private getDevSetupConfig(workspaceRoot: string): any | null {
    const devSetupPath = path.join(workspaceRoot, '.devsetup.json');
    if (!fs.existsSync(devSetupPath)) {
      this.log('No .devsetup.json file found.');
      return null;
    }
    const devSetupContent = fs.readFileSync(devSetupPath, 'utf8');
    return JSON.parse(devSetupContent);
  }

  /**
   * Runs only the requirement check and reports the status.
   */
  async runCheckRequirements(workspaceRoot: string): Promise<CheckResult> {
    this.log(`Running requirements check for ${workspaceRoot}`);
    const devSetupJson = this.getDevSetupConfig(workspaceRoot);

    if (!devSetupJson || !devSetupJson.dependencies) {
      return { ok: true, details: 'No dependencies listed in .devsetup.json to check.' };
    }

    const requirements: DependencyRequirement[] = devSetupJson.dependencies;
    const auditResults = runAudit(requirements);
    const missing = auditResults.filter(r => !r.isInstalled).map(r => r.dependency.name);

    if (missing.length > 0) {
      return { ok: false, details: `Missing dependencies: ${missing.join(', ')}`, missing };
    }

    return { ok: true, details: 'All required dependencies are installed.' };
  }


  /**
   * The full flow: Audit -> Plan -> Execute -> Scaffold
   */
  async runFullValidationAndSetup(workspaceRoot: string, token?: vscode.CancellationToken) {
    this.statusBar.text = 'Dev Orchestrator: Running setup...';
    this.statusBar.show();

    try {
      const devSetupJson = this.getDevSetupConfig(workspaceRoot);
      if (!devSetupJson) {
        vscode.window.showInformationMessage('No .devsetup.json file found. Nothing to do.');
        return { success: true, message: 'No .devsetup.json found.' };
      }

      const requirements: DependencyRequirement[] = devSetupJson.dependencies || [];

      // 1. Audit
      this.log('Auditing dependencies...');
      const auditResults = runAudit(requirements);

      // 2. Plan
      this.log('Creating an action plan...');
      const actionPlan: ActionPlan = createActionPlan(auditResults);
      const stepsToDo = actionPlan.filter(step => step.action !== 'ALREADY_MET');

      if (stepsToDo.length > 0) {
        // 3. Execute
        this.log(`Executing plan: ${stepsToDo.length} steps to run.`);
        await executePlan(actionPlan, this.output);
        this.log('Dependency installation complete.');
      } else {
        this.log('All dependencies are already installed and up to date.');
      }

      // 4. Scaffold
      this.log('Scaffolding project...');
      const scaffoldResult = await scaffoldProject(workspaceRoot, devSetupJson, (msg: string) => {
        this.log(`[scaffold] ${msg}`);
      });

      if (!scaffoldResult.success) {
        throw new Error(`Scaffolding failed: ${scaffoldResult.message}`);
      }
      this.log('Scaffolding complete.');


      vscode.window.showInformationMessage('✅ Workspace is ready to code!');
      this.statusBar.text = 'Dev Orchestrator: Ready';
      return { success: true, message: 'All done' };

    } catch (err: any) {
        this.log(`Full flow failed: ${err.message}`);
        // Show a more helpful message with an action
        const viewOutputButton = 'View Output';
        vscode.window.showErrorMessage(`Orchestration failed: ${err.message}`, viewOutputButton)
            .then(selection => {
                if (selection === viewOutputButton) {
                    this.output.show();
                }
            });
        this.statusBar.text = 'Dev Orchestrator: Error';
        return { success: false, message: err.message };
    } finally {
      setTimeout(() => { try { this.statusBar.hide(); } catch { } }, 3000);
    }
  }
}