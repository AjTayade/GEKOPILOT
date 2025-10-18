// src/extension.ts

import * as vscode from 'vscode';
import { Orchestrator } from './orchestrator';
import { showSetupWizard } from './ui/setupCommands'; // Import the new UI function

// Keep existing activate function structure
export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel('Dev Orchestrator');
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = 'Dev Orchestrator: Idle';
    statusBar.hide();

    const orchestrator = new Orchestrator(output, statusBar);

    // --- NEW COMMAND REGISTRATION ---
    const disposableWizard = vscode.commands.registerCommand('geckopilot.startSetupWizard', async () => {
        // Call the UI function from setupCommands.ts
        await showSetupWizard(orchestrator);
    });
    // --- END NEW COMMAND REGISTRATION ---


    // Keep existing commands
    const disposableSetup = vscode.commands.registerCommand('extension.setupProject', async () => {
        const folder = await pickWorkspaceFolder();
        if (!folder) {
            return;
        }
        // This command now implicitly uses the existing .devsetup.json
        await runFromExistingFileCommand(orchestrator, folder);
    });

    const disposableCheck = vscode.commands.registerCommand('extension.checkRequirements', async () => {
        const folder = await pickWorkspaceFolder();
        if (!folder) {
            return;
        }

        await progressQuick('Checking requirements', async (progress) => {
            const res = await orchestrator.runCheckRequirements(folder.uri.fsPath);
            vscode.window.showInformationMessage(`Requirements: ${res.ok ? 'OK' : 'NOT OK'} — ${res.details || ''}`);
        });
    });

    // Add the new command disposable to subscriptions
    context.subscriptions.push(disposableWizard, disposableSetup, disposableCheck, output, statusBar);

    // --- MODIFICATION TO AUTO-DETECTION ---
    // Modify the auto-detection to potentially offer the wizard or just run from file
    (async () => {
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                // output.appendLine('No workspace open on activation.'); // Keep logging minimal
                return;
            }

            const devsetupFiles = await vscode.workspace.findFiles('**/.devsetup.json', '**/node_modules/**', 1);

            if (devsetupFiles.length > 0) {
                const folder = await pickWorkspaceFolder();
                if (!folder) {
                    return;
                }

                // Offer to run from existing file OR start the wizard to modify/choose preset
                const answer = await vscode.window.showInformationMessage(
                    `.devsetup.json detected in workspace.`,
                    { modal: false }, // Make it non-modal
                    { title: `Run Setup from ${DEVSETUP_FILENAME}` },
                    { title: "Configure with Wizard" },
                    { title: "Later", isCloseAffordance: true }
                );

                if (answer?.title === `Run Setup from ${DEVSETUP_FILENAME}`) {
                     await runFromExistingFileCommand(orchestrator, folder);
                } else if (answer?.title === "Configure with Wizard") {
                     await showSetupWizard(orchestrator); // Start the wizard instead
                } else {
                    output.appendLine('User deferred auto-setup.');
                }
            } else {
                // No file found - maybe prompt user to start wizard? Optional.
                // output.appendLine('No .devsetup.json found at activation.');
            }
        } catch (e: any) {
            output.appendLine(`Activation detection error: ${e.message}`);
        }
    })();
    // --- END MODIFICATION ---


    // --- File watcher potentially needs adjustment ---
    const watcher = vscode.workspace.createFileSystemWatcher('**/.devsetup.json');

    watcher.onDidCreate(async (uri) => {
        // Instead of directly running, maybe just notify or offer the wizard?
        output.appendLine(`.devsetup.json created at ${uri.fsPath}`);
        const folder = vscode.workspace.getWorkspaceFolder(uri);
        if (!folder) return;

        const run = await vscode.window.showInformationMessage(`.devsetup.json was added/modified. Run setup now?`, 'Run Setup', 'Configure with Wizard', 'No');
        if (run === 'Run Setup') {
             await runFromExistingFileCommand(orchestrator, folder);
        } else if (run === 'Configure with Wizard') {
             await showSetupWizard(orchestrator);
        }
    });

     // Optional: React to changes? Could trigger re-run prompt.
     // watcher.onDidChange(async (uri) => { ... });

    context.subscriptions.push(watcher);
    output.appendLine('Dev Orchestrator activated.');
}


// --- Helper Functions (Moved or ensure exported) ---
// Make sure these are accessible by setupCommands.ts, either by exporting or moving

export async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
    const wfs = vscode.workspace.workspaceFolders;
    if (!wfs || wfs.length === 0) {
        vscode.window.showErrorMessage('No workspace folder is open.');
        return undefined;
    }
    if (wfs.length === 1) {
        return wfs[0];
    }

    // If multiple, prompt user
    const choice = await vscode.window.showWorkspaceFolderPick({ placeHolder: 'Select workspace folder for orchestration' });
    return choice;
}

export async function runWithProgress(title: string, cb: (token: vscode.CancellationToken, progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<any>) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: true
    }, async (progress, token) => {
        try {
            // Check for cancellation at the start
            if (token.isCancellationRequested) {
                 vscode.window.showInformationMessage("Operation cancelled.");
                 return { success: false, message: 'Operation cancelled.'}; // Return status
            }
            return await cb(token, progress);
        } catch (e: any) {
             // Orchestrator or Executor should handle showing specific errors.
             // Avoid double-showing the error here unless it's a progress-wrapper specific issue.
             console.error(`${title} failed: ${e.message}`);
             // vscode.window.showErrorMessage(`${title} failed: ${e.message}`);
             // Re-throw so the caller knows it failed
             throw e;
        }
    });
}

// Helper for short quick progress notifications
export async function progressQuick(title: string, cb: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<any>) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false // Typically non-cancellable for quick checks
    }, async (progress) => {
        try {
            return await cb(progress);
        } catch(e: any){
             vscode.window.showErrorMessage(`${title} failed: ${e.message}`);
             throw e;
        }
    });
}

// Helper function to encapsulate running from existing file
async function runFromExistingFileCommand(orchestrator: Orchestrator, folder: vscode.WorkspaceFolder){
     const devSetupPath = path.join(folder.uri.fsPath, DEVSETUP_FILENAME);
    if (!fs.existsSync(devSetupPath)) {
        vscode.window.showErrorMessage(`${DEVSETUP_FILENAME} not found in the selected workspace folder.`);
        return;
    }
     await runWithProgress('Running project setup from file', async (token, progress) => {
        progress.report({ message: `Reading ${DEVSETUP_FILENAME} and starting setup...` });
        await orchestrator.runFullValidationAndSetup(folder.uri.fsPath, token); // Orchestrator reads the file
    });
}


export function deactivate() {
    // cleanup if needed
    console.log('Dev Orchestrator deactivated.');
}