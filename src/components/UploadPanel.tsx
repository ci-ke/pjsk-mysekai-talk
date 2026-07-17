import { useRef, useState } from "react";
import type { Lang, UserProgress } from "../types";
import { formatTimestamp } from "../domain/format";

const FORMAT_LABELS: Record<string, string> = {
  mysekai: "My SEKAI 抓包",
  suite: "Suite 响应",
};

interface UploadPanelProps {
  progress: UserProgress;
  error: string;
  lang: Lang;
  onFile: (file: File) => Promise<void>;
  onClear: () => void;
}

export default function UploadPanel({ progress, error, lang: _lang, onFile, onClear }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const chooseFile = () => inputRef.current?.click();
  const handleFile = async (file?: File) => {
    if (file) await onFile(file);
  };

  return (
    <section className="upload-panel panel">
      <div className="upload-copy">
        <span className="eyebrow">本地处理 · 不上传</span>
        <h2>导入 My SEKAI 抓包数据</h2>
        <p>
          选择 My SEKAI 抓包 JSON 或 Suite 响应 JSON，浏览器自动识别格式并在本地计算蓝图和家具对话进度。
        </p>
        <div className="upload-hints">
          <span>自动识别 My SEKAI / Suite</span>
          <span>支持 compact 对话格式</span>
          <span>数据缓存于浏览器本地</span>
        </div>
      </div>
      <div
        className={`drop-zone${dragging ? " is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={async (event) => {
          event.preventDefault();
          setDragging(false);
          await handleFile(event.dataTransfer.files[0]);
        }}
      >
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          onChange={async (event) => {
            await handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <div className="drop-icon" aria-hidden="true">↥</div>
        <strong>{dragging ? "松开以导入" : "拖放 JSON 到这里"}</strong>
        <span>或</span>
        <button className="button button-primary" type="button" onClick={chooseFile}>
          选择文件
        </button>
      </div>
      {progress.sourceFileName && (
        <div className="file-status">
          <div>
            <span className="status-dot status-dot-success" />
            <strong>{progress.sourceFileName}</strong>
            {progress.detectedFormat && (
              <small>格式：{FORMAT_LABELS[progress.detectedFormat] ?? progress.detectedFormat}</small>
            )}
            {progress.updatedAt && <small>数据时间：{formatTimestamp(progress.updatedAt)}</small>}
          </div>
          <button className="button button-quiet" type="button" onClick={onClear}>清除数据</button>
        </div>
      )}
      {error && <div className="notice notice-error" role="alert">{error}</div>}
    </section>
  );
}
