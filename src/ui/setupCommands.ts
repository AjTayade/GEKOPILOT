// src/ui/setupCommands.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Orchestrator } from '../orchestrator';
import { DependencyRequirement } from '../types';
import { getPresetStackNames, getDependenciesForStack, findDependencyDefinitionById } from '../core/stackDefinition';
import { runWithProgress, pickWorkspaceFolder, runFromExistingFileCommand } from '../extension'; // Correct import path

// FIX: Define constant here
const DEVSETUP_FILENAME = '.devsetup.json';

// Main function to initiate the setup wizard
export async function showSetupWizard(orchestrator: Orchestrator) {
    const options: { label: string; description?: string; action: () => Promise<void> }[] = [
        {
            label: "Select a Preset Stack",
            description: "Install dependencies for common setups (MERN, WebDev...)",
            action: async () => { await handlePresetSelection(orchestrator); },
        },
        {
            label: "Enter Custom Dependencies",
            description: `Specify dependencies to add/update ${DEVSETUP_FILENAME}`, // FIX: Use constant
            action: async () => { await handleCustomInput(orchestrator); },
        },
        {
            label: `Run from existing ${DEVSETUP_FILENAME}`, // FIX: Use constant
            description: "Run setup based on the current file in the workspace",
            action: async () => {
                 const folder = await pickWorkspaceFolder();
                 if (folder) {
                    await runFromExistingFileCommand(orchestrator, folder);
                 }
            },
        },
    ];

    const choice = await vscode.window.showQuickPick(options, {
        placeHolder: "Choose how to configure your development environment setup",
        title: "GeckoPilot Setup Wizard",
    });

    if (choice) {
        await choice.action();
    }
}

// Handler for Preset Stack selection
async function handlePresetSelection(orchestrator: Orchestrator) {
    const stackNames = getPresetStackNames();
    if (stackNames.length === 0) {
        vscode.window.showInformationMessage("No preset stacks are defined.");
        return;
    }
    const selectedStackName = await vscode.window.showQuickPick(stackNames, {
        placeHolder: "Select the preset stack you want to install",
        title: "Select Preset Stack",
    });

    if (!selectedStackName) { return; }

    const dependencies = getDependenciesForStack(selectedStackName);
    if (!dependencies) {
        vscode.window.showErrorMessage(`Internal Error: Could not find definition for stack '${selectedStackName}'.`);
        return;
    }

    const folder = await pickWorkspaceFolder();
    if (!folder) { return; }

    const confirmOverwrite = await vscode.window.showQuickPick(['Yes', 'No'], {
        placeHolder: `This will overwrite ${DEVSETUP_FILENAME} in ${folder.name} with the '${selectedStackName}' preset. Continue?`, // FIX: Use constant
        title: `Confirm Overwrite ${DEVSETUP_FILENAME}` // FIX: Use constant
    });

    if (confirmOverwrite !== 'Yes') { return; }

    try {
        const filePath = path.join(folder.uri.fsPath, DEVSETUP_FILENAME); // FIX: Use constant
        fs.writeFileSync(filePath, JSON.stringify(dependencies, null, 2), 'utf8');
        orchestrator.log(`[UI] Overwrote ${DEVSETUP_FILENAME} with preset '${selectedStackName}'.`); // FIX: Use constant

        await runFromExistingFileCommand(orchestrator, folder);

    } catch (error: any) {
        orchestrator.log(`[UI] Error writing preset to ${DEVSETUP_FILENAME}: ${error.message}`); // FIX: Use constant
        vscode.window.showErrorMessage(`Error saving preset to ${DEVSETUP_FILENAME}: ${error.message}`); // FIX: Use constant
    }
}

// Handler for Custom Dependency input
async function handleCustomInput(orchestrator: Orchestrator) {
    const folder = await pickWorkspaceFolder();
    if (!folder) { return; }

    const input = await vscode.window.showInputBox({
        prompt: `Enter dependency IDs separated by commas (e.g., node, git, python)`,
        placeHolder: "node, git, python, docker",
        title: "Custom Dependencies",
    });

    if (input === undefined) { return; }

    const ids = input.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (ids.length === 0 && input.trim() !== '') {
        vscode.window.showWarningMessage("No valid dependency IDs entered.");
        return;
    }
     if (ids.length === 0 && input.trim() === '') {
         vscode.window.showInformationMessage("No dependencies specified.");
         return;
    }

    const dependencies: DependencyRequirement[] = [];
    const notFound: string[] = [];

    for (const id of ids) {
        const definition = findDependencyDefinitionById(id);
        if (definition) {
            dependencies.push(definition);
        } else {
            notFound.push(id);
        }
    }

    if (notFound.length > 0) {
        vscode.window.showWarningMessage(`Could not find definitions for: ${notFound.join(', ')}. These will be skipped.`);
    }

    if (dependencies.length === 0 && ids.length > 0) {
        vscode.window.showErrorMessage("None of the entered dependencies could be mapped to known configurations.");
        return;
    }

    try {
        const filePath = path.join(folder.uri.fsPath, DEVSETUP_FILENAME); // FIX: Use constant
        let existingDeps: DependencyRequirement[] = [];
        let fileExisted = false;

        if (fs.existsSync(filePath)) {
            fileExisted = true;
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed)) {
                    existingDeps = parsed;
                } else {
                    vscode.window.showWarningMessage(`${DEVSETUP_FILENAME} exists but is not a valid array. Overwriting with new selection.`); // FIX: Use constant
                }
            } catch (readError: any) {
                vscode.window.showWarningMessage(`Could not read existing ${DEVSETUP_FILENAME}: ${readError.message}. Overwriting.`); // FIX: Use constant
            }
        }

        let finalDeps: DependencyRequirement[] = [];
        if (fileExisted && existingDeps.length > 0) {
             const mergeOrOverwrite = await vscode.window.showQuickPick(
                 ['Merge with existing', 'Overwrite existing'],
                 { placeHolder: `How should the new dependencies be added to ${DEVSETUP_FILENAME}?`, title: 'Update Mode'} // FIX: Use constant
             );

             if (!mergeOrOverwrite) { return; }

             if (mergeOrOverwrite === 'Merge with existing') {
                 finalDeps = [...existingDeps];
                 const existingIds = new Set(existingDeps.map(d => d.id));
                 for (const newDep of dependencies) {
                     if (!existingIds.has(newDep.id)) {
                         finalDeps.push(newDep);
                     } else {
                         orchestrator.log(`[UI] Dependency '${newDep.id}' already exists, skipping merge.`);
                     }
                 }
             } else { // Overwrite
                 finalDeps = dependencies;
             }
        } else {
            finalDeps = dependencies;
        }

        fs.writeFileSync(filePath, JSON.stringify(finalDeps, null, 2), 'utf8');
        orchestrator.log(`[UI] Updated ${DEVSETUP_FILENAME} with custom dependencies.`); // FIX: Use constant

        await runFromExistingFileCommand(orchestrator, folder);

    } catch (error: any) {
        orchestrator.log(`[UI] Error writing custom dependencies to ${DEVSETUP_FILENAME}: ${error.message}`); // FIX: Use constant
        vscode.window.showErrorMessage(`Error saving dependencies to ${DEVSETUP_FILENAME}: ${error.message}`); // FIX: Use constant
    }
}