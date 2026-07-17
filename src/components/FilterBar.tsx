import { getGenreUsage } from "../domain/catalog";
import type { Catalog, FilterState, OwnershipFilter, TalkFilter, UnitKey } from "../types";

interface FilterBarProps {
  catalog: Catalog;
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onReset: () => void;
  blueprintDataAvailable: boolean;
  talkDataAvailable: boolean;
  sortBy: "id" | "name" | "progress";
  sortDirection: "asc" | "desc";
  onSortChange: (sortBy: "id" | "name" | "progress", direction: "asc" | "desc") => void;
}

export default function FilterBar({
  catalog,
  filters,
  onChange,
  onReset,
  blueprintDataAvailable,
  talkDataAvailable,
  sortBy,
  sortDirection,
  onSortChange,
}: FilterBarProps) {
  const selectedCharacter = catalog.characters.find(
    (character) => character.id === filters.character.characterId
  );
  const unitOptions = selectedCharacter
    ? [...new Map(selectedCharacter.unitVariants.map((variant) => [variant.unit, variant])).values()]
    : [];

  const genreUsage = getGenreUsage(catalog);
  const activeMainGenres = catalog.genres.main.filter(
    (g) => g.id !== 1 && genreUsage.activeMainGenreIds.has(g.id)
  );
  const mainNameById = new Map(catalog.genres.main.map((g) => [g.id, g.name]));

  // 选中的主分类下的副分类 ID 集合；未选时用全部副分类
  const scopedSubGenreIds =
    filters.mainGenreId != null
      ? genreUsage.subGenreIdsByMain.get(filters.mainGenreId) ?? new Set()
      : new Set(catalog.genres.sub.filter((g) => g.id !== 1).map((g) => g.id));

  /** 为副分类生成消歧标签：若名称跨主分类重复，附加主分类名 */
  function subGenreLabel(sub: { id: number; name: string }) {
    const ambiguous = genreUsage.ambiguousSubGenreNames.get(sub.name);
    if (!ambiguous || ambiguous.length <= 1) return sub.name;
    // 该副分类名对应的所有 id 中，找出各自归属的主分类
    const mainNames: string[] = [];
    for (const sid of ambiguous) {
      for (const [mainId, subIds] of genreUsage.subGenreIdsByMain) {
        if (subIds.has(sid)) {
          const mn = mainNameById.get(mainId);
          if (mn && !mainNames.includes(mn)) mainNames.push(mn);
        }
      }
    }
    if (mainNames.length <= 1) return sub.name;
    // 只有一个主分类选了当前 id 时可以用简称
    const myMains: string[] = [];
    for (const [mainId, subIds] of genreUsage.subGenreIdsByMain) {
      if (subIds.has(sub.id)) {
        const mn = mainNameById.get(mainId);
        if (mn) myMains.push(mn);
      }
    }
    return `${sub.name}（${myMains.join("·")}）`;
  }

  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const setCharacter = (characterId: number | null) => {
    onChange({
      ...filters,
      character: { characterId, unit: null },
    });
  };

  const setUnit = (unit: UnitKey | null) => {
    onChange({ ...filters, character: { ...filters.character, unit } });
  };

  return (
    <section className="filter-panel panel" aria-label="筛选和排序">
      <div className="filter-heading">
        <div>
          <span className="eyebrow">快速定位</span>
          <h2>筛选蓝图与对话</h2>
        </div>
        <button className="button button-quiet" type="button" onClick={onReset}>重置筛选</button>
      </div>
      <div className="filter-grid">
        <label className="field field-wide">
          <span>搜索家具名称 / ID</span>
          <input
            type="search"
            value={filters.search}
            onChange={(event) => set("search", event.target.value)}
            placeholder="例如：床、123"
          />
        </label>
        <label className="field">
          <span>蓝图状态</span>
          <select
            value={filters.ownership}
            disabled={!blueprintDataAvailable}
            onChange={(event) => set("ownership", event.target.value as OwnershipFilter)}
          >
            <option value="all">全部蓝图</option>
            <option value="owned">仅已持有</option>
            <option value="unowned">仅未持有</option>
          </select>
        </label>
        <label className="field">
          <span>角色</span>
          <select
            value={filters.character.characterId ?? ""}
            onChange={(event) => setCharacter(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">全部角色</option>
            {catalog.characters.map((character) => (
              <option key={character.id} value={character.id}>{character.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>虚拟歌手团体</span>
          <select
            value={filters.character.unit ?? ""}
            disabled={!selectedCharacter || unitOptions.length <= 1}
            onChange={(event) => setUnit((event.target.value || null) as UnitKey | null)}
          >
            <option value="">全部团体版本</option>
            {unitOptions.map((variant) => (
              <option key={variant.unit} value={variant.unit}>
                {catalog.unitNames[variant.unit] || variant.unit}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>对话状态</span>
          <select
            value={filters.talk}
            disabled={!talkDataAvailable}
            onChange={(event) => set("talk", event.target.value as TalkFilter)}
          >
            <option value="all">全部对话（包含无对话）</option>
            <option value="hasTalks">全部对话</option>
            <option value="unread">仅未解锁 / 未读</option>
            <option value="read">仅已解锁 / 已读</option>
          </select>
        </label>
        <label className="field">
          <span>主分类</span>
          <select
            value={filters.mainGenreId ?? ""}
            onChange={(event) => {
              const mainId = event.target.value ? Number(event.target.value) : null;
              onChange({ ...filters, mainGenreId: mainId, subGenreId: null });
            }}
          >
            <option value="">全部分类</option>
            {activeMainGenres.map((genre) => (
              <option key={genre.id} value={genre.id}>{genre.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>子分类</span>
          <select
            value={filters.subGenreId ?? ""}
            onChange={(event) => set("subGenreId", event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">全部子分类</option>
            {catalog.genres.sub
              .filter((genre) => genre.id !== 1 && scopedSubGenreIds.has(genre.id))
              .map((genre) => (
                <option key={genre.id} value={genre.id}>{subGenreLabel(genre)}</option>
              ))}
          </select>
        </label>
        <label className="field">
          <span>排序</span>
          <select
            value={`${sortBy}:${sortDirection}`}
            onChange={(event) => {
              const [nextSortBy, nextDirection] = event.target.value.split(":") as [
                "id" | "name" | "progress",
                "asc" | "desc"
              ];
              onSortChange(nextSortBy, nextDirection);
            }}
          >
            <option value="id:asc">蓝图 ID 升序</option>
            <option value="id:desc">蓝图 ID 降序</option>
            <option value="name:asc">名称升序</option>
            <option value="name:desc">名称降序</option>
            <option value="progress:desc">对话进度优先</option>
            <option value="progress:asc">未读优先</option>
          </select>
        </label>
      </div>
      {!blueprintDataAvailable && (
        <p className="filter-note">蓝图状态筛选将在导入用户 JSON 后启用；未导入时仍会展示完整目录。</p>
      )}
      {!talkDataAvailable && (
        <p className="filter-note">当前未检测到角色对话记录，页面会保留对话目录但不会标记已读状态。</p>
      )}
    </section>
  );
}
