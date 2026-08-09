import { useRef } from "react";
import type { UserProgress } from "../types";
import { formatTimestamp } from "../domain/format";

const FORMAT_LABELS: Record<string, string> = {
  mysekai: "My SEKAI 抓包",
  suite: "Suite 响应",
  dual: "My SEKAI + Suite",
};

interface UploadPanelProps {
  mysekaiProgress: UserProgress;
  suiteProgress: UserProgress;
  error: string;
  onFile: (source: "mysekai" | "suite", file: File) => Promise<void>;
  onClear: (source: "mysekai" | "suite") => void;
  onClearAll: () => void;
}

interface SourceConfig {
  key: "mysekai" | "suite";
  label: string;
  desc: string;
}

const SOURCES: SourceConfig[] = [
  { key: "mysekai", label: "My SEKAI 抓包", desc: "蓝图（必有）· 对话（可选）" },
  { key: "suite", label: "Suite 响应", desc: "对话（优先）· 无蓝图" },
];

export default function UploadPanel({ mysekaiProgress, suiteProgress, error, onFile, onClear, onClearAll }: UploadPanelProps) {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const progressBySource = { mysekai: mysekaiProgress, suite: suiteProgress };
  const hasAnyData = Boolean(mysekaiProgress.sourceFileName || suiteProgress.sourceFileName);

  const handleFile = async (source: "mysekai" | "suite", file?: File) => {
    if (file) await onFile(source, file);
  };

  return (
    <section className="upload-panel panel">
      <div className="upload-copy">
        <span className="eyebrow">本地处理 · 不上传</span>
        <h2>导入 My SEKAI 与 Suite 数据</h2>
        <p>
          分别加载两个数据源：蓝图信息从 My SEKAI 获取，对话进度优先使用 Suite 响应。
          只上传一个文件时，缺失的部分按无数据显示。
        </p>
        <div className="upload-hints">
          <span>蓝图从 My SEKAI 获取</span>
          <span>对话优先使用 Suite</span>
          <span>数据缓存于本地</span>
        </div>
      </div>

      <div className="dual-upload">
        {SOURCES.map(({ key, label, desc }) => {
          const progress = progressBySource[key];
          const status = progress.sourceFileName;

          return (
            <div className="source-row" key={key}>
              <div className="source-label">{label}</div>
              <div className="source-desc">{desc}</div>

              {status ? (
                <div className={`file-status source-file-status${key === "suite" ? " file-status-suite" : ""}`}>
                  <div>
                    <span className="status-dot status-dot-success" />
                    <strong>{progress.sourceFileName}</strong>
                    {progress.detectedFormat && (
                      <small>格式：{FORMAT_LABELS[progress.detectedFormat] ?? progress.detectedFormat}</small>
                    )}
                    {progress.updatedAt && <small>数据时间：{formatTimestamp(progress.updatedAt)}</small>}
                  </div>
                  <button className="button button-quiet" type="button" onClick={() => onClear(key)}>清除</button>
                </div>
              ) : (
                <>
                  <input
                    ref={(el) => { inputRefs.current[key] = el; }}
                    className="visually-hidden"
                    type="file"
                    accept=".json,application/json"
                    onChange={async (event) => {
                      await handleFile(key, event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <button className="button button-primary source-choose-btn" type="button" onClick={() => inputRefs.current[key]?.click()}>
                    选择文件
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {hasAnyData && (
        <div className="upload-all-clear">
          <button className="button button-quiet" type="button" onClick={onClearAll}>全部清除</button>
        </div>
      )}

      {error && <div className="notice notice-error" role="alert">{error}</div>}
    </section>
  );
}
