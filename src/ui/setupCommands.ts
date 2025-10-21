// src/ui/setupCommands.ts

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Orchestrator } from '../orchestrator'; //
import { DependencyRequirement } from '../types'; //
// Import ALL_DEPENDENCIES instead of findDependencyDefinitionById
import { getPresetStackNames, getDependenciesForStack, ALL_DEPENDENCIES } from '../core/stackDefinition'; //
import { pickWorkspaceFolder, runFromExistingFileCommand } from '../extension'; //

// Define constant here
const DEVSETUP_FILENAME = '.devsetup.json'; //

// Main function to initiate the setup wizard
export async function showSetupWizard(orchestrator: Orchestrator) { //
    const options: { label: string; description?: string; action: () => Promise<void> }[] = [ //
        {
            label: "Select a Preset Stack", //
            description: "Install dependencies for common setups (MERN, WebDev...)", //
            action: async () => { await handlePresetSelection(orchestrator); }, //
        },
        {
            label: "Select Custom Dependencies", // Changed Label
            description: `Choose individual dependencies to add/update ${DEVSETUP_FILENAME}`, //
            action: async () => { await handleCustomSelection(orchestrator); }, // Changed function call
        },
        {
            label: `Run from existing ${DEVSETUP_FILENAME}`, //
            description: "Run setup based on the current file in the workspace", //
            action: async () => { //
                 const folder = await pickWorkspaceFolder(); //
                 if (folder) { //
                    await runFromExistingFileCommand(orchestrator, folder); //
                 }
            },
        },
    ];

    const choice = await vscode.window.showQuickPick(options, { //
        placeHolder: "Choose how to configure your development environment setup", //
        title: "GeckoPilot Setup Wizard", //
    });

    if (choice) { //
        await choice.action(); //
    }
}

// Handler for Preset Stack selection (remains the same)
async function handlePresetSelection(orchestrator: Orchestrator) { //
    const stackNames = getPresetStackNames(); //
    if (stackNames.length === 0) { //
        vscode.window.showInformationMessage("No preset stacks are defined."); //
        return; //
    }
    const selectedStackName = await vscode.window.showQuickPick(stackNames, { //
        placeHolder: "Select the preset stack you want to install", //
        title: "Select Preset Stack", //
    });

    if (!selectedStackName) { return; } //

    const dependencies = getDependenciesForStack(selectedStackName); //
    if (!dependencies) { //
        vscode.window.showErrorMessage(`Internal Error: Could not find definition for stack '${selectedStackName}'.`); //
        return; //
    }

    const folder = await pickWorkspaceFolder(); //
    if (!folder) { return; } //

    const confirmOverwrite = await vscode.window.showQuickPick(['Yes', 'No'], { //
        placeHolder: `This will overwrite ${DEVSETUP_FILENAME} in ${folder.name} with the '${selectedStackName}' preset. Continue?`, //
        title: `Confirm Overwrite ${DEVSETUP_FILENAME}` //
    });

    if (confirmOverwrite !== 'Yes') { return; } //

    try { //
        const filePath = path.join(folder.uri.fsPath, DEVSETUP_FILENAME); //
        fs.writeFileSync(filePath, JSON.stringify(dependencies, null, 2), 'utf8'); //
        orchestrator.log(`[UI] Overwrote ${DEVSETUP_FILENAME} with preset '${selectedStackName}'.`); //

        await runFromExistingFileCommand(orchestrator, folder); //

    } catch (error: any) { //
        orchestrator.log(`[UI] Error writing preset to ${DEVSETUP_FILENAME}: ${error.message}`); //
        vscode.window.showErrorMessage(`Error saving preset to ${DEVSETUP_FILENAME}: ${error.message}`); //
    }
}

// *** NEW Handler for Custom Dependency SELECTION using Quick Pick ***
async function handleCustomSelection(orchestrator: Orchestrator) {
    const folder = await pickWorkspaceFolder();
    if (!folder) { return; }

    // Prepare QuickPick items from ALL_DEPENDENCIES
    const availableDependencies = Object.values(ALL_DEPENDENCIES); //
    const quickPickItems: vscode.QuickPickItem[] = availableDependencies.map(dep => ({
        label: dep.id, // Use the ID as the primary searchable label
        description: dep.name, // Show the friendly name as description
        // You could add 'detail' for version requirements if desired
        // detail: dep.requiredVersion ? `Requires: ${dep.requiredVersion}` : undefined
    }));

    // Show the multi-select Quick Pick
    const selectedItems = await vscode.window.showQuickPick(quickPickItems, {
        canPickMany: true, // Allow multiple selections
        placeHolder: "Select the dependencies you want to include (type to filter)",
        title: "Select Custom Dependencies",
        ignoreFocusOut: true // Keep open if focus shifts slightly
    });

    // Handle cancellation or no selection
    if (!selectedItems || selectedItems.length === 0) {
        vscode.window.showInformationMessage("No dependencies selected.");
        return;
    }

    // Map selected items back to DependencyRequirement objects
    // Use the ID (label) to look up the full definition, clearing the version requirement
    const dependencies: DependencyRequirement[] = selectedItems.map(item => {
        const fullDef = ALL_DEPENDENCIES[item.label]; // Look up by ID (label)
        // Return a copy, clearing requiredVersion for custom adds
        return { ...(fullDef || {}), id: item.label, name: item.description || item.label, requiredVersion: undefined };
    }).filter(dep => dep.name); // Filter out any potential mismatches (shouldn't happen with QuickPick)


    // --- (The rest of the logic for merging/overwriting and saving remains the same) ---
    try {
        const filePath = path.join(folder.uri.fsPath, DEVSETUP_FILENAME); //
        let existingDeps: DependencyRequirement[] = []; //
        let fileExisted = false; //

        if (fs.existsSync(filePath)) { //
            fileExisted = true; //
            try { //
                const content = fs.readFileSync(filePath, 'utf8'); //
                const parsed = JSON.parse(content); //
                if (Array.isArray(parsed)) { //
                    existingDeps = parsed; //
                } else { //
                    vscode.window.showWarningMessage(`${DEVSETUP_FILENAME} exists but is not a valid array. Overwriting with new selection.`); //
                }
            } catch (readError: any) { //
                vscode.window.showWarningMessage(`Could not read existing ${DEVSETUP_FILENAME}: ${readError.message}. Overwriting.`); //
            }
        }

        let finalDeps: DependencyRequirement[] = []; //
        if (fileExisted && existingDeps.length > 0) { //
             const mergeOrOverwrite = await vscode.window.showQuickPick( //
                 ['Merge with existing', 'Overwrite existing'], //
                 { placeHolder: `How should the selected dependencies be added to ${DEVSETUP_FILENAME}?`, title: 'Update Mode'} //
             );

             if (!mergeOrOverwrite) { return; } //

             if (mergeOrOverwrite === 'Merge with existing') { //
                 finalDeps = [...existingDeps]; //
                 const existingIds = new Set(existingDeps.map(d => d.id)); //
                 for (const newDep of dependencies) { //
                     if (!existingIds.has(newDep.id)) { //
                         finalDeps.push(newDep); //
                     } else { //
                         orchestrator.log(`[UI] Dependency '${newDep.id}' already exists, skipping merge.`); //
                     }
                 }
             } else { // Overwrite //
                 finalDeps = dependencies; //
             }
        } else { //
            finalDeps = dependencies; //
        }

        fs.writeFileSync(filePath, JSON.stringify(finalDeps, null, 2), 'utf8'); //
        orchestrator.log(`[UI] Updated ${DEVSETUP_FILENAME} with selected custom dependencies.`); //

        // Trigger the run from the newly updated/created file
        await runFromExistingFileCommand(orchestrator, folder); //

    } catch (error: any) { //
        orchestrator.log(`[UI] Error writing custom dependencies to ${DEVSETUP_FILENAME}: ${error.message}`); //
        vscode.window.showErrorMessage(`Error saving dependencies to ${DEVSETUP_FILENAME}: ${error.message}`); //
    }
}