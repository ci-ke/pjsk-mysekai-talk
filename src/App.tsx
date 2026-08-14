import { useCallback, useEffect, useMemo, useState } from "react";
import UploadPanel from "./components/UploadPanel";
import ProgressSummary from "./components/ProgressSummary";
import FilterBar from "./components/FilterBar";
import BlueprintCard from "./components/BlueprintCard";
import NoticeBanner from "./components/NoticeBanner";
import { createBlueprintEntries, getEntrySummary } from "./domain/catalog";
import { filterBlueprintEntries, sortBlueprintEntries } from "./domain/filters";
import { parseUserJsonText, UserDataError } from "./domain/userData";
import { loadMysekaiProgress, loadSuiteProgress, saveMysekaiData, saveSuiteData, clearMysekaiData, clearSuiteData, saveLang, loadLang, loadCheckedOff, saveCheckedOff, clearCheckedOff, saveFilters, loadFilters } from "./domain/cache";
import { formatPercent } from "./domain/format";
import type { Catalog, FilterState, Lang, UserProgress } from "./types";

const PAGE_SIZE = 36;
const LANG_LABELS: Record<Lang, string> = {
  cn: "简体中文",
  jp: "日本語",
  tw: "繁體中文",
  en: "English",
  kr: "한국어",
};

const initialFilters: FilterState = {
  ownership: "all",
  talk: "all",
  search: "",
  mainGenreId: null,
  subGenreId: null,
  characterUnitIds: [],
};

function emptyProgress(): UserProgress {
  return {
    ownedBlueprintIds: new Set(),
    talkReadById: new Map(),
    blueprintDataAvailable: false,
    talkDataAvailable: false,
  };
}

function loadInitialState(): { mysekaiProgress: UserProgress; suiteProgress: UserProgress; lang: Lang; checkedOffIds: Set<number> } {
  return { mysekaiProgress: loadMysekaiProgress() ?? emptyProgress(), suiteProgress: loadSuiteProgress() ?? emptyProgress(), lang: loadLang(), checkedOffIds: loadCheckedOff() };
}

export default function App() {
  const [lang, setLang] = useState<Lang>(loadInitialState().lang);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [{ mysekaiProgress: initM, suiteProgress: initS, lang: _initLang, checkedOffIds: initCheckedOffIds }] = useState(loadInitialState);
  const [mysekaiProgress, setMysekaiProgress] = useState<UserProgress>(initM);
  const [suiteProgress, setSuiteProgress] = useState<UserProgress>(initS);
  const [checkedOffIds, setCheckedOffIds] = useState<Set<number>>(initCheckedOffIds);
  const [uploadError, setUploadError] = useState("");
  const [filters, setFilters] = useState<FilterState>(() => loadFilters() ?? initialFilters);
  const [sortBy, setSortBy] = useState<"id" | "name" | "progress">("id");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [jumpInput, setJumpInput] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const loadCatalog = useCallback(async (l: Lang) => {
    setCatalog(null);
    setCatalogError("");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/catalog-${l}.min.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCatalog(data as Catalog);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "加载数据目录失败");
    }
  }, []);

  useEffect(() => {
    loadCatalog(lang);
  }, [lang, loadCatalog]);

  const handleLangChange = useCallback((next: Lang) => {
    setLang(next);
    saveLang(next);
  }, []);

  const progress = useMemo<UserProgress>(() => {
    const blueprint = mysekaiProgress.sourceFileName ? mysekaiProgress : emptyProgress();
    const suite = suiteProgress.sourceFileName ? suiteProgress : emptyProgress();
    const sourceFileName = [blueprint.sourceFileName, suite.sourceFileName].filter(Boolean).join(" + ") || undefined;
    const hasDualFormat = !!(blueprint.sourceFileName && suite.sourceFileName);
    return {
      ownedBlueprintIds: blueprint.ownedBlueprintIds,
      talkReadById: suite.talkDataAvailable ? suite.talkReadById : blueprint.talkReadById,
      blueprintDataAvailable: blueprint.blueprintDataAvailable,
      talkDataAvailable: suite.talkDataAvailable || blueprint.talkDataAvailable,
      sourceFileName,
      updatedAt: suite.updatedAt ?? blueprint.updatedAt,
      detectedFormat: hasDualFormat ? "dual" : blueprint.sourceFileName ? "mysekai" : suite.sourceFileName ? "suite" : undefined,
    };
  }, [mysekaiProgress, suiteProgress]);

  const allEntries = useMemo(
    () => catalog ? createBlueprintEntries(catalog, progress) : [],
    [catalog, progress]
  );
  const filteredEntries = useMemo(() => {
    if (!catalog) return [];
    const filtered = filterBlueprintEntries(allEntries, filters);
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

  useEffect(() => {
    saveFilters(filters);
  }, [filters]);

  async function handleFile(source: "mysekai" | "suite", file: File) {
    setUploadError("");
    if (file.size > 20 * 1024 * 1024) {
      setUploadError("文件超过 20 MB，请确认上传的是正确的 JSON 文件。");
      return;
    }
    try {
      const rawText = await file.text();
      const parsed = parseUserJsonText(rawText, file.name);
      if (source === "mysekai") {
        saveMysekaiData(parsed);
        setMysekaiProgress(parsed);
      } else {
        saveSuiteData(parsed);
        setSuiteProgress(parsed);
      }
      clearCheckedOff();
      setCheckedOffIds(new Set());
      setPage(1);
      setExpandedIds(new Set());
    } catch (error) {
      setUploadError(error instanceof UserDataError ? error.message : "读取文件失败，请确认 JSON 内容完整。");
    }
  }

  function clearSource(source: "mysekai" | "suite") {
    if (source === "mysekai") {
      clearMysekaiData();
      setMysekaiProgress(emptyProgress());
    } else {
      clearSuiteData();
      setSuiteProgress(emptyProgress());
    }
    clearCheckedOff();
    setCheckedOffIds(new Set());
    setPage(1);
  }

  function clearAll() {
    clearMysekaiData();
    clearSuiteData();
    clearCheckedOff();
    setMysekaiProgress(emptyProgress());
    setSuiteProgress(emptyProgress());
    setCheckedOffIds(new Set());
    setUploadError("");
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

  function handleToggleCheckOff(groupId: number) {
    setCheckedOffIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      saveCheckedOff(next);
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
    filters.characterUnitIds.length > 0;

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
            <span>{LANG_LABELS[catalog.lang]}</span>
            <span>纯本地计算</span>
            <span>无需账号</span>
          </div>
        </div>
        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />
      </header>

      <main className="content-wrap">
        <UploadPanel
          mysekaiProgress={mysekaiProgress}
          suiteProgress={suiteProgress}
          error={uploadError}
          onFile={handleFile}
          onClear={clearSource}
          onClearAll={clearAll}
        />

        {!progress.sourceFileName && (
          <NoticeBanner tone="info">
            <strong>还没有导入用户数据。</strong> 当前会展示完整的家具蓝图目录；持有状态和对话已读状态会在选择 JSON 后出现。
          </NoticeBanner>
        )}
        {progress.blueprintDataAvailable && !progress.talkDataAvailable && (
          <NoticeBanner tone="warning">
            已识别蓝图数据，但文件中没有角色对话记录；对话目录仍会展示，状态暂时记为未知。
          </NoticeBanner>
        )}
        {!progress.blueprintDataAvailable && progress.talkDataAvailable && (
          <NoticeBanner tone="warning">
            仅检测到 Suite 对话记录，蓝图持有状态暂不可用，但对话进度正常展示。
          </NoticeBanner>
        )}

        <ProgressSummary all={allSummary} filtered={filteredSummary} progress={progress} catalog={catalog} />
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
          lang={lang}
          onLangChange={handleLangChange}
        />

        <section className="results-section">
          <div className="results-heading">
            <div>
              <span className="eyebrow">My SEKAI 家具</span>
              <h2>{hasFilters ? "筛选结果" : "全部家具"}</h2>
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
                  lang={lang}
                  checkedOffIds={checkedOffIds}
                  onToggleCheckOff={handleToggleCheckOff}
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
            <span>数据语言：{LANG_LABELS[catalog.lang]}</span>
          </div>
          <div>
            <span>蓝图完成率：{progress.blueprintDataAvailable ? formatPercent(allSummary.ownedBlueprints, allSummary.totalRealBlueprints) : "—"}</span>
            <span>数据仅存于当前浏览器</span>
          </div>
        </footer>
      </main>
        </>
      )}
    </div>
  );
}
