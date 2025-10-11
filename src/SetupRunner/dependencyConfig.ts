/**
 * @file dependencyConfig.ts
 * @description A comprehensive configuration file for setting up a developer environment.
 * It maps a wide array of tools to their respective package manager names across
 * Windows (Winget), macOS (Homebrew), and major Linux families.
 */

/**
 * @description This map stores the package names for each dependency.
 * The keys 'win32', 'darwin' correspond to Windows and macOS.
 * The keys 'apt', 'dnf', 'pacman', 'zypper' correspond to the package managers
 * for Debian/Ubuntu, Fedora/RHEL, Arch, and openSUSE families respectively.
 * A 'null' value indicates a non-standard installation method is recommended.
 */
export const PACKAGE_NAMES = {
  // --- Core Languages & Runtimes ---
  'python': {
    'win32': 'Python.Python.3',
    'darwin': 'python@3.12',
    'apt': 'python3',
    'dnf': 'python3',
    'pacman': 'python',
    'zypper': 'python3'
  },
  'node': {
    'win32': 'OpenJS.NodeJS.LTS',
    'darwin': 'node',
    'apt': 'nodejs',
    'dnf': 'nodejs',
    'pacman': 'nodejs',
    'zypper': 'nodejs'
  },
  'java_lts': {
    'win32': 'Microsoft.OpenJDK.21',
    'darwin': 'openjdk@21',
    'apt': 'openjdk-21-jdk',
    'dnf': 'java-21-openjdk-devel',
    'pacman': 'jdk-openjdk', // Arch repos usually track the latest stable JDK
    'zypper': 'java-21-openjdk-devel'
  },
  'go': {
    'win32': 'Go.Go',
    'darwin': 'go',
    'apt': 'golang-go',
    'dnf': 'golang',
    'pacman': 'go',
    'zypper': 'go'
  },
  'rust': {
    'win32': 'Rustlang.Rustup', // Installs the rustup toolchain manager
    'darwin': 'rustup-init',    // Installs the rustup toolchain manager
    'apt': 'rustc',
    'dnf': 'rust',
    'pacman': 'rust',
    'zypper': 'rust'
  },
  'dotnet_sdk': {
    'win32': 'Microsoft.DotNet.SDK.8',
    'darwin': 'dotnet-sdk',
    'apt': 'dotnet-sdk-8.0',
    'dnf': 'dotnet-sdk-8.0',
    'pacman': 'dotnet-sdk',
    'zypper': 'dotnet-sdk-8_0'
  },

  // --- Version Control ---
  'git': {
    'win32': 'Git.Git',
    'darwin': 'git',
    'apt': 'git',
    'dnf': 'git',
    'pacman': 'git',
    'zypper': 'git'
  },

  // --- Databases ---
  'postgres': {
    'win32': 'PostgreSQL.PostgreSQL',
    'darwin': 'postgresql@16',
    'apt': 'postgresql',
    'dnf': 'postgresql-server',
    'pacman': 'postgresql',
    'zypper': 'postgresql-server'
  },
  'mysql': {
    'win32': 'Oracle.MySQL',
    'darwin': 'mysql',
    'apt': 'mysql-server',
    'dnf': 'mysql-server',
    'pacman': 'mariadb', // MariaDB is the default in Arch repos
    'zypper': 'mysql-community-server'
  },
  'mongodb': {
    // NOTE: MongoDB often requires adding a custom repository on Linux distributions.
    // The names below are for the official repos once added.
    'win32': 'MongoDB.Server',
    'darwin': 'mongodb-community',
    'apt': 'mongodb-org',
    'dnf': 'mongodb-org',
    'pacman': 'mongodb',
    'zypper': 'mongodb'
  },
  'redis': {
    'win32': 'Redis.Redis',
    'darwin': 'redis',
    'apt': 'redis-server',
    'dnf': 'redis',
    'pacman': 'redis',
    'zypper': 'redis'
  },
  'sqlite': {
    'win32': 'SQLite.SQLite',
    'darwin': 'sqlite',
    'apt': 'sqlite3',
    'dnf': 'sqlite',
    'pacman': 'sqlite',
    'zypper': 'sqlite3'
  },

  // --- Containerization & DevOps ---
  'docker': {
    'win32': 'Docker.DockerDesktop',
    'darwin': 'docker', // Installs Docker Desktop via Homebrew Cask
    'apt': 'docker.io',
    'dnf': 'moby-engine', // Or 'docker-ce' from Docker's own repo
    'pacman': 'docker',
    'zypper': 'docker'
  },
  'kubernetes_cli': {
    'win32': 'Kubernetes.kubectl',
    'darwin': 'kubernetes-cli',
    'apt': 'kubectl',
    'dnf': 'kubectl',
    'pacman': 'kubectl',
    'zypper': 'kubectl'
  },
  'terraform': {
    'win32': 'HashiCorp.Terraform',
    'darwin': 'terraform',
    'apt': 'terraform',
    'dnf': 'terraform',
    'pacman': 'terraform',
    'zypper': 'terraform'
  },

  // --- Cloud Provider CLIs ---
  'aws_cli': {
    'win32': 'Amazon.AWSCLI',
    'darwin': 'awscli',
    'apt': 'awscli',
    'dnf': 'awscli',
    'pacman': 'aws-cli',
    'zypper': 'aws-cli'
  },
  'azure_cli': {
    'win32': 'Microsoft.AzureCLI',
    'darwin': 'azure-cli',
    'apt': 'azure-cli',
    'dnf': 'azure-cli',
    'pacman': 'azure-cli',
    'zypper': 'azure-cli'
  },
  'gcloud_cli': {
    'win32': 'Google.CloudSDK',
    'darwin': 'google-cloud-sdk',
    'apt': 'google-cloud-cli',
    'dnf': 'google-cloud-cli',
    'pacman': 'google-cloud-sdk',

    'zypper': null // Requires adding a custom repository on openSUSE
  },

  // --- Common Utilities ---
  'jq': {
    'win32': 'stedolan.jq',
    'darwin': 'jq',
    'apt': 'jq',
    'dnf': 'jq',
    'pacman': 'jq',
    'zypper': 'jq'
  },
  'neovim': {
    'win32': 'Neovim.Neovim',
    'darwin': 'neovim',
    'apt': 'neovim',
    'dnf': 'neovim',
    'pacman': 'neovim',
    'zypper': 'neovim'
  }
};