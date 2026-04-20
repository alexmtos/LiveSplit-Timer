export async function simulateDynamicImportReadiness(moduleName: string, ready: boolean, delayMs: number = 0): Promise<boolean> {
  // Simulate delay for dynamic import readiness
  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return ready;
}
