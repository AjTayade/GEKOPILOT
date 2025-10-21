// src/core/stackDefinition.ts

import { DependencyRequirement } from "../types";

// Define standard versions or minimums often suitable for beginners/common use cases
const NODE_LTS_MIN = ">=18.0.0";
const NPM_MIN = ">=8.0.0"; // Usually comes with Node LTS
const GIT_MIN = ">=2.0.0";
const PYTHON_MIN = ">=3.9.0"; // A common baseline
const JAVA_LTS_MIN = ">=21.0.0"; // Example for LTS
const DOTNET_SDK_MIN = ">=8.0.0"; // Example for LTS

/**
 * @description A map containing definitions for known individual dependencies.
 * This serves as the master list for lookup by ID.
 * cliName and versionFlag are provided where common defaults exist.
 */
export const ALL_DEPENDENCIES: { [id: string]: DependencyRequirement } = {
    // --- Core Languages & Runtimes ---
    'python': { id: 'python', name: 'Python 3', cliName: 'python3', versionFlag: '--version', requiredVersion: PYTHON_MIN }, // Use python3 CLI where common
    'node': { id: 'node', name: 'Node.js (LTS)', cliName: 'node', versionFlag: '-v', requiredVersion: NODE_LTS_MIN },
    'npm': { id: 'npm', name: 'NPM', cliName: 'npm', versionFlag: '-v', requiredVersion: NPM_MIN }, // Often installed with Node
    'java_lts': { id: 'java_lts', name: 'Java LTS (JDK 21)', cliName: 'java', versionFlag: '-version', requiredVersion: JAVA_LTS_MIN }, // Note: version flag is different
    'go': { id: 'go', name: 'Go', cliName: 'go', versionFlag: 'version' }, // Note: version flag often needs 'go version' command
    'rust': { id: 'rust', name: 'Rust (via rustup)', cliName: 'rustc', versionFlag: '--version' }, // Checks rustc version
    'dotnet_sdk': { id: 'dotnet_sdk', name: '.NET SDK (LTS)', cliName: 'dotnet', versionFlag: '--version', requiredVersion: DOTNET_SDK_MIN },

    // --- Version Control ---
    'git': { id: 'git', name: 'Git', cliName: 'git', versionFlag: '--version', requiredVersion: GIT_MIN },

    // --- Databases (CLI/Server where applicable via package manager) ---
    'postgres': { id: 'postgres', name: 'PostgreSQL Server', cliName: 'psql', versionFlag: '--version' }, // Checks psql client version
    'mysql': { id: 'mysql', name: 'MySQL Server', cliName: 'mysql', versionFlag: '--version' }, // Checks mysql client version
    'mongodb': { id: 'mongodb', name: 'MongoDB Community Server', cliName: 'mongod', versionFlag: '--version' }, // Checks mongod server version
    'redis': { id: 'redis', name: 'Redis Server', cliName: 'redis-server', versionFlag: '--version' },
    'sqlite': { id: 'sqlite', name: 'SQLite 3', cliName: 'sqlite3', versionFlag: '--version' },

    // --- Containerization & DevOps ---
    'docker': { id: 'docker', name: 'Docker Engine/Desktop', cliName: 'docker', versionFlag: '--version' },
    'kubernetes_cli': { id: 'kubernetes_cli', name: 'Kubernetes CLI (kubectl)', cliName: 'kubectl', versionFlag: 'version --client' }, // Specific flag for kubectl
    'terraform': { id: 'terraform', name: 'Terraform', cliName: 'terraform', versionFlag: '--version' },

    // --- Cloud Provider CLIs ---
    'aws_cli': { id: 'aws_cli', name: 'AWS CLI', cliName: 'aws', versionFlag: '--version' },
    'azure_cli': { id: 'azure_cli', name: 'Azure CLI', cliName: 'az', versionFlag: '--version' },
    'gcloud_cli': { id: 'gcloud_cli', name: 'Google Cloud CLI', cliName: 'gcloud', versionFlag: '--version' },

    // --- Common Utilities ---
    'jq': { id: 'jq', name: 'jq (JSON Processor)', cliName: 'jq', versionFlag: '--version' },
    'neovim': { id: 'neovim', name: 'Neovim', cliName: 'nvim', versionFlag: '--version' },
    'vscode': { id: 'vscode', name: 'VS Code CLI', cliName: 'code', versionFlag: '--version' }, // Added VS Code CLI

    // --- Other potential additions ---
    // 'yarn': { id: 'yarn', name: 'Yarn', cliName: 'yarn', versionFlag: '--version'}, // Often installed via npm
    // 'ruby': { id: 'ruby', name: 'Ruby', cliName: 'ruby', versionFlag: '--version'},
    // 'php': { id: 'php', name: 'PHP', cliName: 'php', versionFlag: '--version'},
    // 'helm': { id: 'helm', name: 'Helm', cliName: 'helm', versionFlag: 'version'},
};

/**
 * @description Defines preset stacks using IDs that reference ALL_DEPENDENCIES.
 */
export const presetStacks: { [key: string]: string[] } = {
    "MERN": [
        'node',     // Includes npm implicitly often, but good to check
        'npm',
        'git',
        'mongodb'
    ],
    "Basic WebDev": [
        'node',
        'npm',
        'git'
    ],
    "General Software Dev": [
        'node',
        'npm',
        'git',
        'python',
        'docker' // Docker is a common general tool
    ],
    "Cloud Native Basics": [
        'git',
        'docker',
        'kubernetes_cli',
        'terraform',
        'jq'
        // Optionally add specific cloud CLIs like 'aws_cli'
    ],
    // Add more stacks as needed
};

// Function to get a list of available stack names
export function getPresetStackNames(): string[] {
    return Object.keys(presetStacks);
}

// Function to get the full dependency definitions for a specific stack name
export function getDependenciesForStack(stackName: string): DependencyRequirement[] | undefined {
    const stackIds = presetStacks[stackName];
    if (!stackIds) {
        return undefined; // Stack name not found
    }

    const dependencies: DependencyRequirement[] = [];
    const notFoundIds: string[] = [];

    for (const id of stackIds) {
        const definition = ALL_DEPENDENCIES[id];
        if (definition) {
            // Return a copy to prevent accidental modification of the master list
            dependencies.push({ ...definition });
        } else {
            notFoundIds.push(id);
            console.warn(`[stackDefinition] Dependency ID '${id}' in stack '${stackName}' not found in ALL_DEPENDENCIES.`);
        }
    }

    // Optional: Could throw an error or show a warning if IDs are missing
    if (notFoundIds.length > 0) {
        // Handle this case as needed - maybe log, maybe inform user later
    }

    return dependencies;
}

// Helper to find a DependencyRequirement definition by its ID
export function findDependencyDefinitionById(id: string): DependencyRequirement | undefined {
    const definition = ALL_DEPENDENCIES[id.toLowerCase()]; // Ensure lowercase lookup
    if (definition) {
        // Return a copy
        // Decide if requiredVersion should be cleared for custom adds:
        // Clearing it makes it simpler, just installs the package manager version.
        // Keeping it might cause unexpected version conflicts if the user doesn't specify one.
        // Let's clear it for simplicity in the custom flow.
        return { ...definition, requiredVersion: undefined };
    }
    // No need for separate fallbacks if 'vscode' and 'java_lts' are in ALL_DEPENDENCIES
    return undefined; // Not found
}