import type { ReactNode } from "react";

interface NoticeBannerProps {
  children: ReactNode;
  tone?: "info" | "warning" | "error";
}

export default function NoticeBanner({ children, tone = "info" }: NoticeBannerProps) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}
