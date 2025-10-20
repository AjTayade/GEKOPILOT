// src/extension.ts

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Orchestrator } from './orchestrator';
import { showSetupWizard } from './ui/setupCommands';

const DEVSETUP_FILENAME = '.devsetup.json';

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel('Dev Orchestrator');
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = 'Dev Orchestrator: Idle';
    statusBar.hide();

    const orchestrator = new Orchestrator(output, statusBar);
    orchestrator.log('GeckoPilot extension activating...'); // Log activation start

    // --- REGISTER COMMANDS ---

    // 1. Main Wizard Command (Primary Entry Point)
    const disposableWizard = vscode.commands.registerCommand('geckopilot.startSetupWizard', async () => {
        orchestrator.log('Command "geckopilot.startSetupWizard" triggered.');
        // Ensure a workspace folder is open before showing the wizard
        const folder = await pickWorkspaceFolder();
        if (!folder) {
             vscode.window.showInformationMessage('Please open a workspace folder before starting the setup wizard.');
            return;
        }
        await showSetupWizard(orchestrator); // Show the UI options
    });

    // 2. Command to run setup directly from .devsetup.json
    const disposableRunFromFile = vscode.commands.registerCommand('geckopilot.runFromFile', async () => {
        orchestrator.log('Command "geckopilot.runFromFile" triggered.');
        const folder = await pickWorkspaceFolder();
        if (!folder) {
             vscode.window.showInformationMessage('Please open a workspace folder containing a .devsetup.json file.');
            return;
        }
        await runFromExistingFileCommand(orchestrator, folder);
    });

    // 3. Command to check requirements directly from .devsetup.json
    const disposableCheckFromFile = vscode.commands.registerCommand('geckopilot.checkFromFile', async () => {
        orchestrator.log('Command "geckopilot.checkFromFile" triggered.');
        const folder = await pickWorkspaceFolder();
        if (!folder) {
             vscode.window.showInformationMessage('Please open a workspace folder containing a .devsetup.json file.');
            return;
        }

        const devSetupPath = path.join(folder.uri.fsPath, DEVSETUP_FILENAME);
        if (!fs.existsSync(devSetupPath)) {
            vscode.window.showErrorMessage(`${DEVSETUP_FILENAME} not found in the selected workspace folder '${folder.name}'. Cannot check requirements.`);
            return;
        }


        await progressQuick('Checking requirements from file', async (progress) => {
            orchestrator.log("Initiating requirements check via command...");
            const res = await orchestrator.runCheckRequirements(folder.uri.fsPath);
            orchestrator.log(`Requirements check result: ok=${res.ok}, details=${res.details || 'N/A'}`);
            // Show result regardless of ok status, details provide info
            vscode.window.showInformationMessage(`Requirements Check: ${res.ok ? 'OK' : 'NOT OK'} — ${res.details || 'No details available.'}`);
        });
    });

    // Add command disposables to subscriptions
    context.subscriptions.push(
        disposableWizard,
        disposableRunFromFile,
        disposableCheckFromFile,
        output, // Dispose output channel on deactivation
        statusBar // Dispose status bar item on deactivation
    );

    // --- REMOVED ---
    // - Auto-detection logic based on file existence on activation.
    // - File watcher logic that prompted user on file changes.

    output.appendLine('GeckoPilot extension activated successfully. Run "GeckoPilot: Configure Environment Setup Wizard" to start.');
}


// --- Helper Functions ---
// (These remain largely the same but ensure they are exported if needed elsewhere, like ui/setupCommands.ts)

export async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
    const wfs = vscode.workspace.workspaceFolders;
    if (!wfs || wfs.length === 0) {
        vscode.window.showErrorMessage('No workspace folder is open.');
        return undefined;
    }
    if (wfs.length === 1) {
        return wfs[0];
    }
    const choice = await vscode.window.showWorkspaceFolderPick({ placeHolder: 'Select workspace folder for GeckoPilot setup' });
    return choice;
}

export async function runWithProgress(title: string, cb: (token: vscode.CancellationToken, progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<any>): Promise<any> {
    let result: any;
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `GeckoPilot: ${title}`, // Add prefix for clarity
        cancellable: true
    }, async (progress, token) => {
        token.onCancellationRequested(() => {
             console.log("User cancelled the GeckoPilot operation");
             // Maybe log to orchestrator? orchestrator.log('Operation cancelled by user.');
        });

        try {
            if (token.isCancellationRequested) {
                 vscode.window.showInformationMessage("Operation cancelled.");
                 result = { success: false, message: 'Operation cancelled.'};
                 return;
            }
            result = await cb(token, progress);
        } catch (e: any) {
             console.error(`GeckoPilot Progress Task "${title}" failed: ${e.message}`);
             // Re-throw so the caller (.catch in command handlers) knows it failed
             // Specific error messages should be shown by Orchestrator/Executor
             throw e;
        }
    });
     return result;
}

export async function progressQuick(title: string, cb: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<any>) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `GeckoPilot: ${title}`, // Add prefix
        cancellable: false
    }, async (progress) => {
        try {
            return await cb(progress);
        } catch(e: any){
             vscode.window.showErrorMessage(`GeckoPilot task "${title}" failed: ${e.message}`);
             throw e;
        }
    });
}

// Helper to run the setup process based on the file
// Needs Orchestrator passed in, must be exported if used by ui/setupCommands.ts
export async function runFromExistingFileCommand(orchestrator: Orchestrator, folder: vscode.WorkspaceFolder){
     const devSetupPath = path.join(folder.uri.fsPath, DEVSETUP_FILENAME);
    if (!fs.existsSync(devSetupPath)) {
        vscode.window.showErrorMessage(`${DEVSETUP_FILENAME} not found in the selected workspace folder '${folder.name}'. Cannot run setup.`);
        return; // Stop execution
    }
     try {
         // Use runWithProgress for consistent UI and cancellation handling
         const result = await runWithProgress(`Running setup from ${DEVSETUP_FILENAME}`, async (token, progress) => {
            progress.report({ message: `Reading ${DEVSETUP_FILENAME} and starting setup...` });
            // Orchestrator reads the file internally
           return await orchestrator.runFullValidationAndSetup(folder.uri.fsPath, token); // return the result
        });

        // Optionally handle success/failure result here if needed,
        // though orchestrator already shows messages.
        if (result && !result.success && result.message !== 'Operation cancelled.') {
             orchestrator.log(`Setup from file command finished with failure.`);
        } else if (result && result.success) {
             orchestrator.log(`Setup from file command finished successfully.`);
        }

     } catch (error: any) {
         // Catch errors re-thrown by runWithProgress or orchestrator
         orchestrator.log(`runFromExistingFileCommand caught error: ${error.message || error}`);
         // No need to show another message here, should be handled upstream
     }
}


export function deactivate() {
    console.log('GeckoPilot extension deactivated.');
    // Cleanup resources if any were created globally
}