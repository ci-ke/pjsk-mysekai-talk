import { useMemo, useState } from "react";
import type { BlueprintEntry, Catalog, EnrichedTalkGroup } from "../types";
import { getCharacterColor, getFixtureThumbnailUrl, getInitials } from "../domain/assets";
import { getGroupCharacterNames, getUnitName } from "../domain/catalog";
import TalkViewer from "./TalkViewer";

interface BlueprintCardProps {
  entry: BlueprintEntry;
  catalog: Catalog;
  expanded: boolean;
  onToggle: () => void;
}

function TalkState({ group }: { group: EnrichedTalkGroup }) {
  const stateText = {
    unknown: "状态未知",
    unread: "未解锁 / 未读",
    partial: "部分已读",
    read: "已解锁 / 已读",
  }[group.readState];
  return <span className={`talk-state talk-state-${group.readState}`}>{stateText}</span>;
}

export default function BlueprintCard({ entry, catalog, expanded, onToggle }: BlueprintCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const fixture = entry.fixture;
  const imageUrl = imageFailed ? "/placeholder.svg" : getFixtureThumbnailUrl(fixture);
  const talkCount = entry.talkGroups.reduce((sum, group) => sum + group.totalCount, 0);
  const readCount = entry.talkGroups.reduce((sum, group) => sum + group.readCount, 0);
  const uniqueCharacters = useMemo(
    () => [...new Set(entry.talkGroups.flatMap((group) => getGroupCharacterNames(catalog, group)))],
    [catalog, entry.talkGroups]
  );

  return (
    <article className={`blueprint-card${entry.owned ? " is-owned" : " is-unowned"}`}>
      <div className="blueprint-card-top">
        <div className={`fixture-image${!entry.owned && entry.ownershipKnown ? " is-dimmed" : ""}`}>
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
            <span className={`ownership-badge ${entry.ownershipKnown ? (entry.owned ? "owned" : "unowned") : "unknown"}`}>
              {entry.ownershipKnown ? (entry.owned ? "已持有" : "未持有") : "未导入"}
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
            <strong>{entry.talkGroups.length ? `${readCount} / ${talkCount}` : "无关联对话"}</strong>
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
        <button className="button button-link" type="button" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? "收起详情 ↑" : "查看对话详情 ↓"}
        </button>
      </div>
      {expanded && (
        <div className="talk-details">
          {entry.talkGroups.length === 0 ? (
            <p className="empty-inline">该家具目前没有可展示的角色家具对话关联。</p>
          ) : (
            entry.talkGroups.map((group) => {
              const groupUnits = [...new Set(
                group.characterUnitIds.map((unitId) => catalog.characterUnits.find((unit) => unit.id === unitId)?.unit)
              )].filter((unit): unit is string => Boolean(unit));
              const furnitureNames = group.fixtureIds
                .map((id) => catalog.fixtures.find((item) => item.id === id)?.name)
                .filter(Boolean);
              return (
                <div className="talk-group" key={group.id}>
                  <div className="talk-group-heading">
                    <div>
                      <strong>对话组 #{group.archiveId}</strong>
                    </div>
                    <TalkState group={group} />
                  </div>
                  <div className="talk-group-meta">
                    <span>角色：{getGroupCharacterNames(catalog, group).join("、") || "未知"}</span>
                    {groupUnits.length > 0 && (
                      <span>团体：{groupUnits.map((unit) => getUnitName(catalog, unit)).join("、")}</span>
                    )}
                    <span>家具条件：{furnitureNames.join("、") || "未知"}</span>
                  </div>
                  <div className="talk-progress-detail">
                    {group.readState === "unknown"
                      ? "上传包含 userMysekaiCharacterTalks 的数据后可显示已读状态。"
                      : `已读 ${group.readCount} / ${group.totalCount}`}
                  </div>
                  <TalkViewer group={group} catalog={catalog} />
                </div>
              );
            })
          )}
        </div>
      )}
    </article>
  );
}
