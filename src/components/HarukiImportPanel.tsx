import { useEffect, useMemo, useState } from "react";
import {
  HARUKI_SERVERS,
  buildHarukiDirectLinks,
  buildMysekaiUrl,
  buildSuiteUrl,
  defaultApiBase,
  fetchHarukiJson,
  harukiErrorText,
  harukiServerLabel,
  isHarukiServer,
  normalizeApiBase,
  normalizeGameId,
  type HarukiServer,
  type HarukiSource,
} from "../domain/haruki";
import { loadHarukiSettings, saveHarukiSettings } from "../domain/cache";

const SOURCE_LABELS: Record<HarukiSource, string> = {
  mysekai: "My SEKAI",
  suite: "Suite",
};

const REQUEST_TIMEOUT_MS = 45_000;

interface HarukiImportPanelProps {
  onImport: (source: HarukiSource, json: unknown, label: string) => void;
}

export default function HarukiImportPanel({ onImport }: HarukiImportPanelProps) {
  const stored = useMemo(() => loadHarukiSettings(), []);
  const [server, setServer] = useState<HarukiServer>(stored?.server ?? "cn");
  const [gameIdInput, setGameIdInput] = useState(stored?.gameId ?? "");
  const [apiBaseInput, setApiBaseInput] = useState(stored?.apiBase ?? defaultApiBase());
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState<HarukiSource | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const gameId = normalizeGameId(gameIdInput);

  useEffect(() => {
    saveHarukiSettings({ server, gameId: gameIdInput, apiBase: apiBaseInput });
  }, [server, gameIdInput, apiBaseInput]);

  const directLinks = useMemo(
    () => (gameId ? buildHarukiDirectLinks(server, gameId) : []),
    [gameId, server]
  );

  async function handleImport(source: HarukiSource) {
    if (!gameId) {
      setError("请填写有效的游戏 ID（纯数字）。");
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setBusy(source);
    setError("");
    setNotice("");

    try {
      const base = normalizeApiBase(apiBaseInput);
      const url = source === "mysekai"
        ? buildMysekaiUrl(base, server, gameId)
        : buildSuiteUrl(base, server, gameId);
      const json = await fetchHarukiJson(url, { signal: controller.signal });
      onImport(source, json, `Haruki · ${harukiServerLabel(server)} · ${gameId}`);
      setNotice(`${SOURCE_LABELS[source]} 数据已导入。`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("请求超时。可以重试，或改用「打开 JSON」保存文件后上传。");
      } else {
        setError(harukiErrorText(err));
      }
    } finally {
      clearTimeout(timer);
      setBusy(null);
    }
  }

  return (
    <details className="haruki-panel panel">
      <summary className="haruki-summary">
        <span className="eyebrow">Haruki 数据源</span>
        <h2>用区服和游戏 ID 获取数据</h2>
        <p>公开过抓包数据的账号可直接取回 JSON；也可以打开链接另存后上传。</p>
      </summary>

      <div className="haruki-body">
        <p className="haruki-lead">
          在 Haruki 工具箱公开过数据的账号，填写区服与游戏 ID 就能拿到对应的抓包 JSON。
          浏览器存在跨域限制，所以最稳妥的方式是<b>打开 JSON 链接、另存为文件后上传</b>；
          本地运行 <code>npm run dev</code> 时也可以点击「通过代理导入」一步完成。
        </p>

        <div className="haruki-form">
          <label className="field">
            <span>区服</span>
            <select
              value={server}
              onChange={(event) => {
                if (isHarukiServer(event.target.value)) {
                  setServer(event.target.value);
                  setError("");
                  setNotice("");
                }
              }}
            >
              {HARUKI_SERVERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="field haruki-field-id">
            <span>游戏 ID</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              placeholder="输入游戏 ID（纯数字）"
              value={gameIdInput}
              onChange={(event) => {
                setGameIdInput(event.target.value);
                setError("");
                setNotice("");
              }}
            />
          </label>

          <button
            className="button button-quiet haruki-advanced-toggle"
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            高级：接口地址
          </button>
        </div>

        {advancedOpen && (
          <div className="haruki-advanced">
            <label className="field">
              <span>接口地址 / 代理</span>
              <input
                type="text"
                spellCheck={false}
                value={apiBaseInput}
                onChange={(event) => setApiBaseInput(event.target.value)}
                placeholder={defaultApiBase()}
              />
            </label>
            <p>
              默认 {defaultApiBase()}，由 vite dev/preview 转发到 Haruki 公开接口；
              自建反代时填它的完整地址（需要允许跨域）。「打开 JSON」链接始终直连公开接口，不受此设置影响。
            </p>
          </div>
        )}

        {gameId ? (
          <div className="haruki-links">
            {directLinks.map((link) => (
              <div className="haruki-link-row" key={link.source}>
                <div className="haruki-link-info">
                  <strong>{link.label}</strong>
                  <small>{link.description}</small>
                </div>
                <div className="haruki-link-actions">
                  <a
                    className="button button-primary"
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    打开 JSON
                  </a>
                  <button
                    className="button button-quiet"
                    type="button"
                    disabled={busy !== null}
                    onClick={() => handleImport(link.source)}
                  >
                    {busy === link.source ? "获取中…" : "通过代理导入"}
                  </button>
                </div>
              </div>
            ))}
            <p className="haruki-tip">
              打开 JSON 后按 Ctrl+S（或右键另存为）保存，再回到上面的上传框选择该文件即可，文件名不限。
            </p>
          </div>
        ) : (
          <p className="haruki-tip">
            {gameIdInput.trim()
              ? "游戏 ID 需为纯数字，请检查后重试。"
              : "填写游戏 ID 后显示获取链接。"}
          </p>
        )}

        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {notice && <div className="notice notice-info">{notice}</div>}
      </div>
    </details>
  );
}
