import { describe, expect, it } from "vitest";

import { createBuildGenerationCoordinator } from "./build-generation";

type BuildResult = {
  name: string;
  objectUrls: Array<string>;
};

function deferred<Result>() {
  let resolve!: (result: Result) => void;
  const promise = new Promise<Result>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("createBuildGenerationCoordinator", () => {
  it("keeps the newer build when an older build finishes last", async () => {
    const coordinator = createBuildGenerationCoordinator();
    const buildA = deferred<BuildResult>();
    const buildB = deferred<BuildResult>();
    let session: string | null = null;
    let currentUrls: Array<string> = [];
    const revoked: Array<string> = [];
    const run = (build: Promise<BuildResult>) =>
      coordinator.run({
        build: () => build,
        commit: (result) => {
          revoked.push(...currentUrls);
          currentUrls = result.objectUrls;
          session = result.name;
        },
        discard: (result) => revoked.push(...result.objectUrls),
      });

    const runA = run(buildA.promise);
    const runB = run(buildB.promise);
    buildB.resolve({ name: "B", objectUrls: ["blob:b"] });

    await expect(runB).resolves.toEqual({ status: "committed" });
    expect(session).toBe("B");
    expect(currentUrls).toEqual(["blob:b"]);
    expect(coordinator.isBuilding()).toBe(false);

    buildA.resolve({ name: "A", objectUrls: ["blob:a"] });

    await expect(runA).resolves.toEqual({ status: "stale" });
    expect(session).toBe("B");
    expect(currentUrls).toEqual(["blob:b"]);
    expect(revoked).toEqual(["blob:a"]);
  });

  it("discards a build result after the session is invalidated", async () => {
    const coordinator = createBuildGenerationCoordinator();
    const build = deferred<BuildResult>();
    let session: string | null = null;
    const revoked: Array<string> = [];
    const running = coordinator.run({
      build: () => build.promise,
      commit: (result) => {
        session = result.name;
      },
      discard: (result) => revoked.push(...result.objectUrls),
    });

    coordinator.invalidate();
    expect(coordinator.isBuilding()).toBe(false);
    build.resolve({ name: "A", objectUrls: ["blob:a"] });

    await expect(running).resolves.toEqual({ status: "stale" });
    expect(session).toBeNull();
    expect(revoked).toEqual(["blob:a"]);
  });

  it("keeps the current generation building when a stale build finishes", async () => {
    const coordinator = createBuildGenerationCoordinator();
    const buildA = deferred<BuildResult>();
    const buildB = deferred<BuildResult>();
    const run = (build: Promise<BuildResult>) =>
      coordinator.run({
        build: () => build,
        commit: () => undefined,
        discard: () => undefined,
      });

    const runA = run(buildA.promise);
    const runB = run(buildB.promise);
    buildA.resolve({ name: "A", objectUrls: [] });

    await expect(runA).resolves.toEqual({ status: "stale" });
    expect(coordinator.isBuilding()).toBe(true);

    buildB.resolve({ name: "B", objectUrls: [] });
    await expect(runB).resolves.toEqual({ status: "committed" });
    expect(coordinator.isBuilding()).toBe(false);
  });
});
