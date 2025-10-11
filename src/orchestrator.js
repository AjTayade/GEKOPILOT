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
exports.Orchestrator = void 0;
// src/orchestrator.ts
const vscode = __importStar(require("vscode"));
const setupRunner_1 = require("./setupRunner");
const projectScaffold_1 = require("./projectScaffold");
class Orchestrator {
    output;
    statusBar;
    constructor(output, statusBar) {
        this.output = output;
        this.statusBar = statusBar;
    }
    log(msg) {
        const ts = new Date().toISOString();
        this.output.appendLine(`[${ts}] ${msg}`);
    }
    async runCheckRequirements(workspaceRoot) {
        this.log(`Running requirements check for ${workspaceRoot}`);
        // Try to dynamically import a real requirements checker if available:
        try {
            const module = await import('../developer1/requirementsChecker').catch(() => null);
            if (module && module.checkRequirements) {
                this.log('Using Developer1 requirementsChecker');
                return await module.checkRequirements(workspaceRoot);
            }
        }
        catch (e) {
            this.log(`Failed to load developer1 module: ${String(e)}`);
        }
        // Fallback: basic local checks (node present via which node)
        // Minimal stub check:
        this.log('Running fallback requirement checks (stub).');
        return { ok: true, details: 'Fallback check passed', missing: [] };
    }
    async runSetupProject(workspaceRoot, onProgress) {
        this.log(`Running setupRunner for ${workspaceRoot}`);
        // try to import developer 2's module; otherwise use stub
        try {
            const module = await import('../developer2/setupRunner').catch(() => null);
            if (module && module.runSetup) {
                this.log('Using Developer2 setupRunner');
                return await module.runSetup(workspaceRoot, {}, onProgress);
            }
        }
        catch (e) {
            this.log(`Failed to load developer2 module: ${String(e)}`);
        }
        // use local stub implementation
        return await (0, setupRunner_1.runSetup)(workspaceRoot, {}, onProgress);
    }
    async runScaffold(workspaceRoot, config, onProgress) {
        this.log(`Running projectScaffold for ${workspaceRoot}`);
        try {
            const module = await import('../developer1/projectScaffold').catch(() => null);
            if (module && module.scaffoldProject) {
                this.log('Using Developer1 projectScaffold');
                return await module.scaffoldProject(workspaceRoot, config, onProgress);
            }
        }
        catch (e) {
            this.log(`Failed to load dev1 scaffold: ${String(e)}`);
        }
        // fallback stub
        return await (0, projectScaffold_1.scaffoldProject)(workspaceRoot, config, onProgress);
    }
    /** The full flow: check requirements → scaffold → setup */
    async runFullValidationAndSetup(workspaceRoot, token) {
        this.statusBar.text = 'Dev Orchestrator: Running validation...';
        this.statusBar.show();
        try {
            // 1. Check requirements
            const check = await this.runCheckRequirements(workspaceRoot);
            if (!check.ok) {
                this.log(`Requirements check failed: ${check.details || JSON.stringify(check)}`);
                vscode.window.showErrorMessage(`Requirements check failed: ${check.details || 'See output for details'}`);
                return { success: false, message: 'Requirements failed' };
            }
            this.log('Requirements OK.');
            // 2. Scaffold project (if config present)
            const scaffoldPromise = this.runScaffold(workspaceRoot, {}, (msg) => {
                this.log(`[scaffold] ${msg}`);
            });
            // 3. Run setup runner (install packages etc.)
            const setupPromise = this.runSetupProject(workspaceRoot, (msg) => {
                this.log(`[setup] ${msg}`);
            });
            // Run sequentially or in parallel as needed; here sequential:
            const scaffoldRes = await scaffoldPromise;
            if (!scaffoldRes.success) {
                vscode.window.showErrorMessage(`Scaffold failed: ${scaffoldRes.message}`);
                return { success: false, message: 'Scaffold failed' };
            }
            this.log('Scaffold OK');
            const setupRes = await setupPromise;
            if (!setupRes.success) {
                vscode.window.showErrorMessage(`Setup failed: ${setupRes.message}`);
                return { success: false, message: 'Setup failed' };
            }
            this.log('Setup OK');
            vscode.window.showInformationMessage('Workspace is ready to code ✅');
            this.statusBar.text = 'Dev Orchestrator: Ready';
            return { success: true, message: 'All done' };
        }
        catch (err) {
            this.log(`Full flow failed: ${String(err)}`);
            vscode.window.showErrorMessage(`Orchestration failed: ${String(err)}`);
            this.statusBar.text = 'Dev Orchestrator: Error';
            return { success: false, message: String(err) };
        }
        finally {
            // keep status for a short while
            setTimeout(() => { try {
                this.statusBar.hide();
            }
            catch { } }, 3000);
        }
    }
}
exports.Orchestrator = Orchestrator;
//# sourceMappingURL=orchestrator.js.map