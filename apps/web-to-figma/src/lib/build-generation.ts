type BuildRun<Result> = {
  build: () => Promise<Result>;
  commit: (result: Result) => void;
  discard: (result: Result) => void;
};

type BuildOutcome =
  | { status: "committed" }
  | { status: "stale" }
  | { status: "failed"; error: unknown };

export function createBuildGenerationCoordinator() {
  let generation = 0;
  let activeGeneration: number | null = null;

  return {
    async run<Result>({
      build,
      commit,
      discard,
    }: BuildRun<Result>): Promise<BuildOutcome> {
      generation += 1;
      const runGeneration = generation;
      activeGeneration = runGeneration;

      try {
        let result: Result;
        try {
          result = await build();
        } catch (error) {
          return activeGeneration === runGeneration
            ? { status: "failed", error }
            : { status: "stale" };
        }

        if (activeGeneration !== runGeneration) {
          discard(result);
          return { status: "stale" };
        }

        commit(result);
        return { status: "committed" };
      } finally {
        if (activeGeneration === runGeneration) {
          activeGeneration = null;
        }
      }
    },
    invalidate() {
      generation += 1;
      activeGeneration = null;
    },
    isBuilding() {
      return activeGeneration !== null;
    },
  };
}
