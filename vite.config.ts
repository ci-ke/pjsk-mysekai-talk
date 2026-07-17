import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Normalize VITE_BASE_PATH into a "/-prefixed, /-trailing base URL.
 *
 * MSYS2 Git Bash on Windows rewrites POSIX-like path segments found in
 * environment values and command arguments — `/mysekai-talk/` may become
 * `C:/Program Files/Git/mysekai-talk/` or `/Development/PortableGit/mysekai-talk/`.
 * To stay immune we always extract the last meaningful path segment.
 */
function normalizeBasePath(value: string | undefined) {
  if (!value || value === "/") return "/";
  if (/^https?:\/\//.test(value)) return value.endsWith("/") ? value : `${value}/`;
  const segments = value.split("\\").join("/").split("/").filter(Boolean);
  const last = segments.at(-1);
  return last ? `/${last}/` : "/";
}

export default defineConfig(({ mode }) => {
  return {
    base: normalizeBasePath(process.env.VITE_BASE_PATH),
    plugins: [react()],
    test: {
      environment: "node",
      globals: true,
    },
  };
});
