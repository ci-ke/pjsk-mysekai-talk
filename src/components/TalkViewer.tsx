import { useState } from "react";
import type { Catalog, EnrichedTalkGroup, Lang } from "../types";
import { getTalkScriptUrl, parseTalkScript } from "../domain/assets";

interface TalkViewerProps {
  group: EnrichedTalkGroup;
  catalog: Catalog;
  lang: Lang;
}

/** 按索引配对 talkId → 家具名，数量不等时用回退名 */
function formatTalkFurniturePairs(group: EnrichedTalkGroup, catalog: Catalog): string[] {
  const fixtureNames = group.fixtureIds.map(
    (id) => catalog.fixtures.find((f) => f.id === id)?.name || `家具 ${id}`
  );
  if (group.talks.length === fixtureNames.length) {
    return group.talks.map((talk, idx) => `#${talk.id}（${fixtureNames[idx]}）`);
  }
  // 数量不等：只列 ID
  return group.talks.map((talk) => `#${talk.id}`);
}

export default function TalkViewer({ group, catalog, lang }: TalkViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const firstTalk = group.talks[0];
  const pairs = formatTalkFurniturePairs(group, catalog);

  async function loadContent() {
    if (content) {
      setExpanded((prev) => !prev);
      return;
    }
    if (!firstTalk) return;
    setLoading(true);
    setError("");
    try {
      const url = getTalkScriptUrl(firstTalk, lang);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setContent(parseTalkScript(text));
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
      setExpanded(true);
    } finally {
      setLoading(false);
    }
  }

  if (!group.talks.length) {
    return <p className="empty-inline">该对话组没有可展示的具体对话。</p>;
  }

  return (
    <div className="talk-detail">
      <div className="talk-summary-row">
        <span className="talk-summary-label">对话</span>
        <span className="talk-summary-ids">{pairs.join("\u2009·\u2009")}</span>
      </div>

      {firstTalk && (
        <div className="talk-script-area">
          <button
            className="button button-link talk-script-toggle"
            type="button"
            onClick={loadContent}
            disabled={loading}
          >
            {loading ? "加载中…" : expanded ? "收起脚本 ↑" : "查看对话脚本 ↓"}
          </button>
          {expanded && (
            <div className="talk-script-body">
              {error ? (
                <p className="talk-item-error">加载失败：{error}</p>
              ) : content ? (
                <pre className="talk-script">{content}</pre>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
