// src/setupRunner.ts
import * as vscode from 'vscode';
import { ISetupRunner, SetupResult } from './types';

/**
 * Stub / wrapper for the Setup Runner (Developer 2).
 * Dev2 should export a function named runSetup that matches this signature.
 *
 * This file currently contains a friendly stub that simulates work.
 * Replace internals with actual implementation from Developer 2.
 */

export const runSetup: ISetupRunner['runSetup'] = async (workspaceRoot: string, options?: any, onProgress?: (msg: string) => void) => {
  onProgress?.(`Starting setup for ${workspaceRoot}`);
  // Simulate steps with delays
  const steps = ['Installing base packages', 'Configuring workspace', 'Finalizing'];
  for (const s of steps) {
    onProgress?.(s);
    await new Promise((res) => setTimeout(res, 800)); // simulate time
  }
  onProgress?.('Setup complete');
  return { success: true, message: 'Stub setup completed' };
};
