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

export default defineConfig(() => {
  // Haruki 公开接口只为白名单来源返回 CORS 头，浏览器直连会被拦；
  // dev/preview 用同源代理转发，静态部署时需要自建反代或改用下载后上传。
  const harukiProxy = {
    "/api/haruki-public": {
      target: "https://suite-api.haruki.seiunx.com",
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/api\/haruki-public/, "/public"),
    },
  };

  return {
    base: normalizeBasePath(process.env.VITE_BASE_PATH),
    plugins: [react()],
    server: { proxy: harukiProxy },
    preview: { proxy: harukiProxy },
    test: {
      environment: "node",
      globals: true,
    },
  };
});
