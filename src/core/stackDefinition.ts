// src/core/stackDefinitions.ts

import { DependencyRequirement } from "../types";

// Define standard versions or minimums often suitable for beginners
const NODE_LTS_MIN = ">=18.0.0";
const NPM_MIN = ">=8.0.0"; // Usually comes with Node LTS
const GIT_MIN = ">=2.0.0";
const PYTHON_MIN = ">=3.9.0"; // A common baseline

export const presetStacks: { [key: string]: DependencyRequirement[] } = {
    "MERN": [
        { id: "node", name: "Node.js (LTS)", cliName: "node", requiredVersion: NODE_LTS_MIN },
        { id: "npm", name: "NPM", cliName: "npm", requiredVersion: NPM_MIN },
        { id: "git", name: "Git", cliName: "git", requiredVersion: GIT_MIN },
        { id: "mongodb", name: "MongoDB Community Server", cliName: "mongod", versionFlag: "--version" } // Note: MongoDB install often needs manual repo setup on Linux
    ],
    "Basic WebDev": [
        { id: "node", name: "Node.js (LTS)", cliName: "node", requiredVersion: NODE_LTS_MIN },
        { id: "npm", name: "NPM", cliName: "npm", requiredVersion: NPM_MIN },
        { id: "git", name: "Git", cliName: "git", requiredVersion: GIT_MIN },
    ],
    "General Software Dev": [
        { id: "node", name: "Node.js (LTS)", cliName: "node", requiredVersion: NODE_LTS_MIN },
        { id: "npm", name: "NPM", cliName: "npm", requiredVersion: NPM_MIN },
        { id: "git", name: "Git", cliName: "git", requiredVersion: GIT_MIN },
        { id: "python", name: "Python 3", cliName: "python3", versionFlag: "--version", requiredVersion: PYTHON_MIN }, // Use python3 for CLI
        { id: "docker", name: "Docker Desktop/Engine", cliName: "docker", requiredVersion: undefined } // Version checks for Docker can be complex
    ],
    // Add more stacks as needed (e.g., Python/Django, Java, etc.)
};

// Function to get a list of available stack names
export function getPresetStackNames(): string[] {
    return Object.keys(presetStacks);
}

// Function to get the dependencies for a specific stack name
export function getDependenciesForStack(stackName: string): DependencyRequirement[] | undefined {
    return presetStacks[stackName];
}

// Helper to find a DependencyRequirement definition by its ID (used for custom input)
// This maps a simple name/id string back to a full definition needed by the orchestrator.
// Note: This is a basic lookup. A more robust version might search dependencyConfig.ts
// or have a more comprehensive master list.
export function findDependencyDefinitionById(id: string): DependencyRequirement | undefined {
    for (const stackName in presetStacks) {
        const found = presetStacks[stackName].find(dep => dep.id === id);
        if (found) {
            // Return a copy to avoid accidental modification
            return { ...found, requiredVersion: undefined }; // Don't enforce version for custom adds by default? Or prompt?
        }
    }
    // Add fallbacks for common tools not explicitly in stacks above if needed
    if (id === 'code' || id === 'vscode') {
        return { id: 'vscode', name: 'VS Code CLI', cliName: 'code', versionFlag: '--version' };
    }
     if (id === 'java') {
        return { id: 'java_lts', name: 'Java LTS (e.g., JDK 21)', cliName: 'java', versionFlag: '-version'}; // Java version flag is different
    }
    // Add more common tools as needed
    return undefined; // Not found in presets
}