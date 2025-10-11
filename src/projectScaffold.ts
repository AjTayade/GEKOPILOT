// src/projectScaffold.ts
import { IProjectScaffold, SetupResult } from './types';

/**
 * Stub for projectScaffold (Developer 1 or 2).
 * Replace with real scaffold logic.
 * This is a placeholder and does not perform any actual file operations.
 */
export const scaffoldProject: IProjectScaffold['scaffoldProject'] = async (workspaceRoot, config, onProgress) => {
  onProgress?.('Scaffolding project structure');
  await new Promise((res) => setTimeout(res, 700));
  onProgress?.('Writing template files');
  await new Promise((res) => setTimeout(res, 700));
  onProgress?.('Scaffold complete');
  return { success: true, message: 'Scaffold stub finished' };
};