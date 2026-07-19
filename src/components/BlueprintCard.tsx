import { useMemo, useState } from "react";
import type { BlueprintEntry, Catalog, EnrichedTalkGroup, Lang } from "../types";
import { getCharacterColor, getFixtureThumbnailUrl, getInitials } from "../domain/assets";
import { getGroupCharacterNames, getUnitName } from "../domain/catalog";
import TalkViewer from "./TalkViewer";

interface BlueprintCardProps {
  entry: BlueprintEntry;
  catalog: Catalog;
  expanded: boolean;
  onToggle: () => void;
  lang: Lang;
  checkedOffIds: Set<number>;
  onToggleCheckOff: (groupId: number) => void;
}

function TalkState({ group, checkedOff }: { group: EnrichedTalkGroup; checkedOff: boolean }) {
  if (checkedOff) {
    return <span className="talk-state talk-state-checked-off">已读</span>;
  }
  const stateText = {
    unknown: "状态未知",
    unread: "未读",
    read: "已读",
  }[group.readState];
  return <span className={`talk-state talk-state-${group.readState}`}>{stateText}</span>;
}

export default function BlueprintCard({ entry, catalog, expanded, onToggle, lang, checkedOffIds, onToggleCheckOff }: BlueprintCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const fixture = entry.fixture;
  const imageUrl = imageFailed ? "/placeholder.svg" : getFixtureThumbnailUrl(fixture, lang);
  const totalGroups = entry.talkGroups.length;
  const readGroups = entry.talkGroups.filter((group) => group.readState === "read" || checkedOffIds.has(group.id)).length;
  const uniqueCharacters = useMemo(
    () => [...new Set(entry.talkGroups.flatMap((group) => getGroupCharacterNames(catalog, group)))],
    [catalog, entry.talkGroups]
  );

  return (
    <article className={`blueprint-card${entry.owned ? " is-owned" : " is-unowned"}`}>
      <div className="blueprint-card-top">
        <div className={`fixture-image${!entry.owned && entry.ownershipKnown && !entry.isVirtual ? " is-dimmed" : ""}`}>
          <img
            src={imageUrl}
            alt={fixture?.name || entry.blueprint.fixtureName || `家具 ${entry.blueprint.id}`}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
          <span className="fixture-id">#{entry.blueprint.id}</span>
        </div>
        <div className="blueprint-card-copy">
          <div className="card-title-row">
            <h3>{fixture?.name || entry.blueprint.fixtureName || "未关联家具"}</h3>
            <span className={`ownership-badge ${entry.isVirtual ? "virtual" : entry.ownershipKnown ? (entry.owned ? "owned" : "unowned") : "unknown"}`}>
              {entry.isVirtual ? "无需蓝图" : entry.ownershipKnown ? (entry.owned ? "已持有" : "未持有") : "未导入"}
            </span>
          </div>
          <p className="card-subtitle">
            蓝图 ID {entry.blueprint.id} · 家具 ID {entry.blueprint.fixtureId ?? "—"}
          </p>
          <div className="tag-row">
            <span className="tag tag-category">{entry.mainGenreName}</span>
            {entry.subGenreName && <span className="tag">{entry.subGenreName}</span>}
            {entry.blueprint.isEnableSketch && <span className="tag tag-soft">可抄写</span>}
            {entry.blueprint.isObtainedByConvert && <span className="tag tag-soft">可转化</span>}
          </div>
          <div className="card-progress-line">
            <span>角色家具对话</span>
            <strong>{totalGroups ? `${readGroups} / ${totalGroups}` : "无关联对话"}</strong>
          </div>
          {uniqueCharacters.length > 0 && (
            <div className="character-summary">
              {uniqueCharacters.slice(0, 4).map((name) => {
                const character = catalog.characters.find((item) => item.name === name);
                const variant = character?.unitVariants[0];
                return (
                  <span className="character-pill" key={name}>
                    <span
                      className="character-dot"
                      style={{ background: getCharacterColor(variant?.colorCode) }}
                    >
                      {getInitials(name)}
                    </span>
                    {name}
                  </span>
                );
              })}
              {uniqueCharacters.length > 4 && <span className="character-more">+{uniqueCharacters.length - 4}</span>}
            </div>
          )}
        </div>
      </div>
      <div className="blueprint-card-footer">
        <span className="muted-label">
          {entry.talkGroups.length ? `${entry.talkGroups.length} 个对话组` : "暂无角色家具对话"}
        </span>
        {entry.talkGroups.length > 0 && (
          <button className="button button-link" type="button" onClick={onToggle} aria-expanded={expanded}>
            {expanded ? "收起详情 ↑" : "查看对话详情 ↓"}
          </button>
        )}
      </div>
      {expanded && entry.talkGroups.length > 0 && (
        <div className="talk-details">
          {entry.talkGroups.map((group) => {
              const groupUnits = [...new Set(
                group.characterUnitIds.map((unitId) => catalog.characterUnits.find((unit) => unit.id === unitId)?.unit)
              )].filter((unit): unit is string => Boolean(unit));
              const furnitureNames = group.fixtureIds
                .map((id) => catalog.fixtures.find((item) => item.id === id)?.name)
                .filter(Boolean);
              const isCheckedOff = checkedOffIds.has(group.id);
              const isUnread = group.readState === "unread";
              return (
                <div className="talk-group" key={group.id}>
                  <div className="talk-group-heading">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <strong>对话组 #{group.id}</strong>
                      {group.hasHiddenTalks && (
                        <span className="tag tag-soft">隐藏</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {isUnread && (
                        <button
                          className={`check-off-btn${isCheckedOff ? " check-off-btn-active" : ""}`}
                          type="button"
                          title={isCheckedOff ? "取消已读标记" : "标记为已读"}
                          onClick={() => onToggleCheckOff(group.id)}
                          aria-label={isCheckedOff ? "取消已读标记" : "标记为已读"}
                        >
                          {isCheckedOff ? "☑" : "☐"}
                        </button>
                      )}
                      <TalkState group={group} checkedOff={isUnread && isCheckedOff} />
                    </div>
                  </div>
                  <div className="talk-group-meta">
                    <span>角色：{getGroupCharacterNames(catalog, group).join("、") || "未知"}</span>
                    {groupUnits.length > 0 && (
                      <span>团体：{groupUnits.map((unit) => getUnitName(catalog, unit)).join("、")}</span>
                    )}
                    <span>家具条件：{furnitureNames.join("、") || "未知"}</span>
                  </div>
                  <TalkViewer group={group} catalog={catalog} lang={lang} />
                </div>
              );
            })
          }
        </div>
      )}
    </article>
  );
}
