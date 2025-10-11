// src/extension.ts

import * as vscode from 'vscode';
import { Orchestrator } from './orchestrator';

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel('Dev Orchestrator');
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = 'Dev Orchestrator: Idle';
    statusBar.hide();

    const orchestrator = new Orchestrator(output, statusBar);

    // register commands
    const disposableSetup = vscode.commands.registerCommand('extension.setupProject', async () => {
        const folder = await pickWorkspaceFolder();
        if (!folder) { 
            return; 
        }

        await runWithProgress('Running project setup', async (token, progress) => {
            progress.report({ message: 'Starting full setup...' });
            await orchestrator.runFullValidationAndSetup(folder.uri.fsPath, token);
        });
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

    context.subscriptions.push(disposableSetup, disposableCheck, output, statusBar);

    // on activation - detect .devsetup.json
    (async () => {
        try {
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                output.appendLine('No workspace open on activation.');
                return;
            }

            const devsetupFiles = await vscode.workspace.findFiles('**/.devsetup.json', '**/node_modules/**', 1);

            if (devsetupFiles.length > 0) {
                const folder = await pickWorkspaceFolder();
                if (!folder) {
                    return;
                }

                const answer = await vscode.window.showInformationMessage('.devsetup.json detected in workspace. Run full validation + auto-setup now?', 'Run now', 'Later');
                if (answer === 'Run now') {
                    await runWithProgress('Auto: validating & setting up workspace', async (token, progress) => {
                        progress.report({ message: 'Validating requirements...' });
                        await orchestrator.runFullValidationAndSetup(folder.uri.fsPath, token);
                    });
                } else {
                    output.appendLine('User deferred auto-setup.');
                }
            } else {
                output.appendLine('No .devsetup.json found at activation.');
            }
        } catch (e: any) {
            output.appendLine(`Activation detection error: ${e.message}`);
        }
    })();

    const watcher = vscode.workspace.createFileSystemWatcher('**/.devsetup.json');

    watcher.onDidCreate(async (uri) => {
        output.appendLine('.devsetup.json created - prompting to setup workspace');
        const folder = await pickWorkspaceFolder();
        if (!folder) {
            return;
        }

        const run = await vscode.window.showInformationMessage('.devsetup.json was added — run auto-setup?', 'Yes', 'No');
        if (run === 'Yes') {
            await runWithProgress('Scaffolding + Setup', async (token) => {
                await orchestrator.runFullValidationAndSetup(folder.uri.fsPath, token);
            });
        }
    });

    context.subscriptions.push(watcher);
    output.appendLine('Dev Orchestrator activated.');
}


// helper: pick a workspace folder (handles multi-root)
async function pickWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
    const wfs = vscode.workspace.workspaceFolders;
    if (!wfs || wfs.length === 0) {
        vscode.window.showErrorMessage('No workspace folder is open.');
        return undefined;
    }
    if (wfs.length === 1) {
        return wfs[0];
    }

    const choice = await vscode.window.showWorkspaceFolderPick({ placeHolder: 'Select workspace folder for orchestration' });
    return choice;
}

// helper to run with a cancellable long progress
async function runWithProgress(title: string, cb: (token: vscode.CancellationToken, progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<any>) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: true
    }, async (progress, token) => {
        try {
            return await cb(token, progress);
        } catch (e: any) {
            vscode.window.showErrorMessage(`${title} failed: ${e.message}`);
            throw e;
        }
    });
}

// helper for short quick progress notifications
async function progressQuick(title: string, cb: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<any>) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false
    }, async (progress) => {
        return await cb(progress);
    });
}

export function deactivate() {
    // cleanup if needed
}