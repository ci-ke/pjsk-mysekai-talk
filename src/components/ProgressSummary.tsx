import type { EntrySummary, UserProgress } from "../types";
import { formatPercent } from "../domain/format";

interface ProgressSummaryProps {
  all: EntrySummary;
  filtered: EntrySummary;
  progress: UserProgress;
}

function StatCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default function ProgressSummary({ all, filtered, progress }: ProgressSummaryProps) {
  const ownershipDetail = progress.blueprintDataAvailable
    ? `${all.ownedBlueprints}/${all.totalBlueprints} · ${formatPercent(all.ownedBlueprints, all.totalBlueprints)}`
    : "上传文件后显示";
  const talkDetail = progress.talkDataAvailable
    ? `${all.readTalks}/${all.totalTalks} · ${formatPercent(all.readTalks, all.totalTalks)}`
    : "上传包含对话记录的文件后显示";

  return (
    <section className="summary-grid" aria-label="收集进度">
      <StatCard
        label="家具蓝图"
        value={progress.blueprintDataAvailable ? `${all.ownedBlueprints} / ${all.totalBlueprints}` : `${all.totalBlueprints}`}
        detail={ownershipDetail}
        tone="blue"
      />
      <StatCard
        label="角色家具对话"
        value={progress.talkDataAvailable ? `${all.readTalks} / ${all.totalTalks}` : "—"}
        detail={talkDetail}
        tone="pink"
      />
      <StatCard
        label="当前筛选"
        value={`${filtered.totalBlueprints} 件`}
        detail={`蓝图目录共 ${all.totalBlueprints} 件`}
        tone="purple"
      />
      <StatCard
        label="数据状态"
        value={progress.sourceFileName ? "已载入" : "未载入"}
        detail={progress.sourceFileName ? "状态来自本地文件" : "请先选择 JSON"}
        tone="green"
      />
    </section>
  );
}
