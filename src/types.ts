export interface CleanupOptions {
  outdir: string;
  dryRun: boolean;
  keepHours: number;
}

export interface TempCleanupOptions {
  dryRun: boolean;
  keepHours: number;
}
