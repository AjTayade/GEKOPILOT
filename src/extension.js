"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// src/extension.ts
const vscode = __importStar(require("vscode"));
const orchestrator_1 = require("./orchestrator");
function activate(context) {
    const output = vscode.window.createOutputChannel('Dev Orchestrator');
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBar.text = 'Dev Orchestrator: Idle';
    statusBar.hide();
    const orchestrator = new orchestrator_1.Orchestrator(output, statusBar);
    // register commands
    const disposableSetup = vscode.commands.registerCommand('extension.setupProject', async () => {
        const folder = pickWorkspaceFolder();
        if (!folder)
            return;
        await runWithProgress('Running project setup', async (token, progress) => {
            progress.report({ message: 'Starting full setup...' });
            await orchestrator.runFullValidationAndSetup(folder.uri.fsPath);
        });
    });
    const disposableCheck = vscode.commands.registerCommand('extension.checkRequirements', async () => {
        const folder = pickWorkspaceFolder();
        if (!folder)
            return;
        progressQuick('Checking requirements', async (progress) => {
            const res = await orchestrator.runCheckRequirements(folder.uri.fsPath);
            vscode.window.showInformationMessage(`Requirements: ${res.ok ? 'OK' : 'NOT OK'} — ${res.details || ''}`);
        });
    });
    context.subscriptions.push(disposableSetup, disposableCheck, output, statusBar);
    // on activation - detect .devsetup.json or .env
    (async () => {
        try {
            // wait for workspace to be ready
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                output.appendLine('No workspace open on activation.');
                return;
            }
            // Search for .devsetup.json
            const devsetupFiles = await vscode.workspace.findFiles('**/.devsetup.json', '**/node_modules/**', 1);
            const envFiles = await vscode.workspace.findFiles('**/.env', '**/node_modules/**', 1);
            if (devsetupFiles.length > 0 || envFiles.length > 0) {
                const folder = pickWorkspaceFolder();
                if (!folder)
                    return;
                // Ask user to confirm auto-setup (safer)
                const answer = await vscode.window.showInformationMessage('.devsetup.json or .env detected in workspace. Run full validation + auto-setup now?', 'Run now', 'Later');
                if (answer === 'Run now') {
                    await runWithProgress('Auto: validating & setting up workspace', async (token, progress) => {
                        progress.report({ message: 'Validating requirements...' });
                        await orchestrator.runFullValidationAndSetup(folder.uri.fsPath, token);
                    });
                }
                else {
                    output.appendLine('User deferred auto-setup.');
                }
            }
            else {
                output.appendLine('No .devsetup.json or .env found at activation.');
            }
        }
        catch (e) {
            output.appendLine(`Activation detection error: ${String(e)}`);
        }
    })();
    // Setup a watcher to react to .devsetup.json creation/changes
    const watcher = vscode.workspace.createFileSystemWatcher('**/.devsetup.json');
    watcher.onDidCreate(async (uri) => {
        output.appendLine('.devsetup.json created - prompting to setup workspace');
        const folder = pickWorkspaceFolder();
        if (!folder)
            return;
        const run = await vscode.window.showInformationMessage('.devsetup.json was added — run auto-setup?', 'Yes', 'No');
        if (run === 'Yes') {
            await runWithProgress('Scaffolding + Setup', async (token) => {
                await orchestrator.runFullValidationAndSetup(folder.uri.fsPath, token);
            });
        }
    });
    watcher.onDidChange((uri) => {
        output.appendLine('.devsetup.json changed');
    });
    watcher.onDidDelete((uri) => {
        output.appendLine('.devsetup.json deleted');
    });
    context.subscriptions.push(watcher);
    output.appendLine('Dev Orchestrator activated.');
}
// helper: pick a workspace folder (handles multi-root)
function pickWorkspaceFolder() {
    const wfs = vscode.workspace.workspaceFolders;
    if (!wfs || wfs.length === 0) {
        vscode.window.showErrorMessage('No workspace folder is open.');
        return undefined;
    }
    if (wfs.length === 1)
        return wfs[0];
    // If multiple, prompt user
    const choice = vscode.window.showWorkspaceFolderPick({ placeHolder: 'Select workspace folder for orchestration' });
    return choice;
}
// helper to run with a cancellable long progress
async function runWithProgress(title, cb) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: true
    }, async (progress, token) => {
        try {
            return await cb(token, progress);
        }
        catch (e) {
            vscode.window.showErrorMessage(`${title} failed: ${String(e)}`);
            throw e;
        }
    });
}
// helper for short quick progress notifications
async function progressQuick(title, cb) {
    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false
    }, async (progress) => {
        return await cb(progress);
    });
}
function deactivate() {
    // cleanup if needed
}
//# sourceMappingURL=extension.js.map