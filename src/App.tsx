import { useEffect, useMemo, useState } from "react";
import UploadPanel from "./components/UploadPanel";
import ProgressSummary from "./components/ProgressSummary";
import FilterBar from "./components/FilterBar";
import BlueprintCard from "./components/BlueprintCard";
import NoticeBanner from "./components/NoticeBanner";
import { createBlueprintEntries, getEntrySummary } from "./domain/catalog";
import { filterBlueprintEntries, sortBlueprintEntries } from "./domain/filters";
import { parseUserJsonText, UserDataError } from "./domain/userData";
import { loadProgress, saveProgress, clearProgress } from "./domain/cache";
import { formatPercent } from "./domain/format";
import type { Catalog, FilterState, UserProgress } from "./types";

const PAGE_SIZE = 36;

const initialFilters: FilterState = {
  ownership: "all",
  talk: "all",
  search: "",
  mainGenreId: null,
  subGenreId: null,
  character: { characterId: null, unit: null },
};

function emptyProgress(): UserProgress {
  return {
    ownedBlueprintIds: new Set(),
    talkReadById: new Map(),
    blueprintDataAvailable: false,
    talkDataAvailable: false,
  };
}

function loadInitialState(): UserProgress {
  return loadProgress() ?? emptyProgress();
}

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [progress, setProgress] = useState<UserProgress>(loadInitialState);
  const [uploadError, setUploadError] = useState("");
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [sortBy, setSortBy] = useState<"id" | "name" | "progress">("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [jumpInput, setJumpInput] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/catalog.min.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setCatalog(data as Catalog))
      .catch((err) => setCatalogError(err.message || "加载数据目录失败"));
  }, []);

  const allEntries = useMemo(
    () => catalog ? createBlueprintEntries(catalog, progress) : [],
    [catalog, progress]
  );
  const filteredEntries = useMemo(() => {
    if (!catalog) return [];
    const filtered = filterBlueprintEntries(allEntries, catalog, filters);
    return sortBlueprintEntries(filtered, sortBy, sortDirection);
  }, [catalog, allEntries, filters, sortBy, sortDirection]);
  const allSummary = useMemo(() => getEntrySummary(allEntries), [allEntries]);
  const filteredSummary = useMemo(() => getEntrySummary(filteredEntries), [filteredEntries]);
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const pageEntries = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filters, sortBy, sortDirection]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function handleFile(file: File) {
    setUploadError("");
    clearProgress();
    if (file.size > 20 * 1024 * 1024) {
      setUploadError("文件超过 20 MB，请确认上传的是单个 My SEKAI JSON。 ");
      return;
    }
    try {
      const rawText = await file.text();
      const parsed = parseUserJsonText(rawText, file.name);
      saveProgress(rawText, file.name);
      setProgress(parsed);
      setFilters(initialFilters);
      setPage(1);
      setExpandedIds(new Set());
    } catch (error) {
      setUploadError(error instanceof UserDataError ? error.message : "读取文件失败，请确认 JSON 内容完整。 ");
    }
  }

  function clearData() {
    clearProgress();
    setProgress(emptyProgress());
    setUploadError("");
    setFilters(initialFilters);
    setPage(1);
    setExpandedIds(new Set());
  }

  function toggleExpanded(blueprintId: number) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(blueprintId)) next.delete(blueprintId);
      else next.add(blueprintId);
      return next;
    });
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function handleJump() {
    const target = Number(jumpInput);
    if (Number.isFinite(target) && target >= 1 && target <= totalPages) {
      setPage(target);
      setJumpInput("");
    }
  }

  const hasFilters =
    filters.ownership !== "all" ||
    filters.talk !== "all" ||
    Boolean(filters.search) ||
    filters.mainGenreId !== null ||
    filters.subGenreId !== null ||
    filters.character.characterId !== null;

  return (
    <div className="app-shell">
      {catalogError ? (
        <main className="content-wrap">
          <div className="empty-state panel">
            <div className="empty-state-icon">!</div>
            <h3>数据目录加载失败</h3>
            <p>{catalogError}</p>
            <button className="button button-primary" type="button" onClick={() => window.location.reload()}>
              重试
            </button>
          </div>
        </main>
      ) : !catalog ? (
        <main className="content-wrap">
          <div className="empty-state panel">
            <div className="empty-state-icon">⟳</div>
            <h3>正在加载数据目录…</h3>
            <p>从服务器获取最新的家具与对话数据。</p>
          </div>
        </main>
      ) : (
        <>
          <header className="hero">
        <div className="hero-inner">
          <div className="hero-kicker"><span className="hero-mark">MS</span> My SEKAI · 浏览器工具</div>
          <h1>蓝图与家具对话收集情况</h1>
          <p className="hero-lead">
            把 `/msb` 带到浏览器：导入自己的抓包 JSON，快速找出还没拿到的蓝图和角色家具对话。
          </p>
          <div className="hero-meta">
            <span>{catalog.source ?? "—"} v{catalog.masterVersion ?? "—"}</span>
            <span>纯本地计算</span>
            <span>无需账号</span>
          </div>
        </div>
        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />
      </header>

      <main className="content-wrap">
        <UploadPanel
          progress={progress}
          error={uploadError}
          onFile={handleFile}
          onClear={clearData}
        />

        {!progress.sourceFileName && (
          <NoticeBanner tone="info">
            <strong>还没有导入用户数据。</strong> 当前会展示完整的家具蓝图目录；持有状态和对话已读状态会在选择 JSON 后出现。
          </NoticeBanner>
        )}
        {progress.sourceFileName && !progress.talkDataAvailable && (
          <NoticeBanner tone="warning">
            已识别蓝图数据，但文件中没有角色对话记录；对话目录仍会展示，状态暂时记为未知。
          </NoticeBanner>
        )}

        <ProgressSummary all={allSummary} filtered={filteredSummary} progress={progress} />
        <FilterBar
          catalog={catalog}
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters(initialFilters)}
          blueprintDataAvailable={progress.blueprintDataAvailable}
          talkDataAvailable={progress.talkDataAvailable}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={(nextSortBy, nextDirection) => {
            setSortBy(nextSortBy);
            setSortDirection(nextDirection);
          }}
        />

        <section className="results-section">
          <div className="results-heading">
            <div>
              <span className="eyebrow">Blueprint index</span>
              <h2>{hasFilters ? "筛选结果" : "全部家具蓝图"}</h2>
            </div>
            <div className="results-count">
              <strong>{filteredEntries.length}</strong>
              <span> / {allEntries.length} 件</span>
              {expandedIds.size > 0 && (
                <button className="button button-quiet" type="button" onClick={collapseAll}>
                  全部收起
                </button>
              )}
            </div>
          </div>

          {pageEntries.length === 0 ? (
            <div className="empty-state panel">
              <div className="empty-state-icon">⌕</div>
              <h3>没有符合条件的蓝图</h3>
              <p>试试清除角色、对话状态或分类筛选。</p>
              <button className="button button-primary" type="button" onClick={() => setFilters(initialFilters)}>
                清除筛选
              </button>
            </div>
          ) : (
            <div className="blueprint-grid">
              {pageEntries.map((entry) => (
                <BlueprintCard
                  key={entry.blueprint.id}
                  entry={entry}
                  catalog={catalog}
                  expanded={expandedIds.has(entry.blueprint.id)}
                  onToggle={() => toggleExpanded(entry.blueprint.id)}
                />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="pagination" aria-label="蓝图分页">
              <button className="button button-quiet" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                ← 上一页
              </button>
              <span>第 {page} / {totalPages} 页</span>
              <button className="button button-quiet" type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                下一页 →
              </button>
              <form
                className="pagination-jump"
                onSubmit={(e) => { e.preventDefault(); handleJump(); }}
              >
                <input
                  className="jump-input"
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  placeholder={`1-${totalPages}`}
                  aria-label="跳转到指定页"
                />
                <button className="button button-quiet" type="submit">跳转</button>
              </form>
            </nav>
          )}
        </section>

        <footer className="app-footer">
          <div>
            <strong>My SEKAI 蓝图与对话</strong>
            <span>数据目录：{catalog.source} · MasterData v{catalog.masterVersion ?? "—"}</span>
          </div>
          <div>
            <span>蓝图完成率：{progress.blueprintDataAvailable ? formatPercent(allSummary.ownedBlueprints, allSummary.totalBlueprints) : "—"}</span>
            <span>数据仅存于当前浏览器</span>
          </div>
        </footer>
      </main>
        </>
      )}
    </div>
  );
}
