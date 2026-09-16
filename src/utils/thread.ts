// Helper: Yields execution to the main browser thread event loop
export const yieldToMain = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));
