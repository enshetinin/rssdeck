import "server-only";

import packageJson from "../../package.json";

/**
 * "0.2.0", plus the deployed commit when the host provides it
 * (Render sets RENDER_GIT_COMMIT), e.g. "0.2.0 · 36e7d24".
 */
export function appVersionLabel(
  version: string = packageJson.version,
  commit: string | undefined = process.env.RENDER_GIT_COMMIT,
): string {
  const shortCommit = commit && /^[0-9a-f]{7,40}$/i.test(commit) ? commit.slice(0, 7) : null;
  return shortCommit ? `${version} · ${shortCommit}` : version;
}
