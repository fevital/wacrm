"use client";

import Link from "next/link";
import type { Deal, PipelineStage } from "@/types";
import {
  Calendar,
  Check,
  X,
  MessageSquare,
  CheckSquare2,
  Square,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useTranslations } from "next-intl";

interface DealCardProps {
  deal: Deal;
  stage: PipelineStage | null;
  onEdit: (deal: Deal) => void;
  isOverlay?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelection?: (dealId: string) => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function initials(name?: string, fallback?: string) {
  const source = (name || fallback || "?").trim();
  if (!source) return "?";
  return source.charAt(0).toUpperCase();
}

export function DealCard({
  deal,
  stage,
  onEdit,
  isOverlay,
  selectionMode = false,
  selected = false,
  onToggleSelection,
}: DealCardProps) {
  const t = useTranslations("Pipelines.card");
  const contactLabel =
    deal.contact?.name || deal.contact?.phone || t("noContact");
  const assigneeLabel = deal.assignee?.full_name || null;
  const commissionPercentage = Number(deal.commission_percentage || 0);
  const expectedCommission =
    Number(deal.value || 0) * (commissionPercentage / 100);

  return (
    <div
      className={`group relative w-full rounded-xl border bg-muted/70 text-left shadow-sm transition-all ${
        selected
          ? "border-primary bg-primary/10 ring-2 ring-primary/25"
          : "border-border/50"
      } ${
        isOverlay
          ? "shadow-xl"
          : selectionMode
            ? "hover:border-primary/60 hover:bg-primary/5"
            : "hover:-translate-y-0.5 hover:border-border hover:bg-muted hover:shadow-lg"
      }`}
    >
      {/* 4px left accent bar using stage color */}
      <span
        aria-hidden
        className="absolute left-0 top-0 z-10 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
      />

      <button
        type="button"
        onClick={(event) => {
          if (isOverlay) return;
          event.stopPropagation();

          if (selectionMode) {
            onToggleSelection?.(deal.id);
            return;
          }

          onEdit(deal);
        }}
        className={`block w-full cursor-pointer rounded-xl py-3 pl-4 pr-3 text-left ${
          deal.conversation_id && !selectionMode && !isOverlay ? "pb-9" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className="flex-1 break-words text-sm font-semibold leading-snug text-foreground">
            {deal.title}
          </h4>

          <div className="flex shrink-0 items-center gap-1">
            {selectionMode &&
              (selected ? (
                <CheckSquare2 className="h-4 w-4 text-primary" />
              ) : (
                <Square className="h-4 w-4 text-muted-foreground" />
              ))}

            {deal.status === "won" && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Check className="h-3 w-3" />
                {t("won")}
              </span>
            )}

            {deal.status === "lost" && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                <X className="h-3 w-3" />
                {t("lost")}
              </span>
            )}
          </div>
        </div>

        {/* Contact row */}
        <div className="mt-2 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
            {initials(deal.contact?.name, deal.contact?.phone)}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {contactLabel}
          </span>

          {deal.conversation_id && (
            <span
              title="Conversa do WhatsApp vinculada"
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            >
              <MessageSquare className="h-3 w-3" />
              Conversa
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-bold text-primary">
            {formatCurrency(deal.value, deal.currency)}
          </span>
          {deal.expected_close_date && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(deal.expected_close_date)}
            </span>
          )}
        </div>

        <div className="mt-1 text-[11px] text-muted-foreground">
          {t("commission", {
            percentage: commissionPercentage.toLocaleString(),
            value: formatCurrency(expectedCommission, deal.currency),
          })}
        </div>

        {assigneeLabel && (
          <div className="mt-2 flex items-center justify-end">
            <span
              title={assigneeLabel}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
            >
              {initials(assigneeLabel)}
            </span>
          </div>
        )}
      </button>

      {deal.conversation_id && !selectionMode && !isOverlay && (
        <Link
          href={`/inbox?c=${deal.conversation_id}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          title="Abrir conversa no WhatsApp"
          className="absolute bottom-2 left-4 inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/20"
        >
          <MessageSquare className="h-3 w-3" />
          Abrir conversa
        </Link>
      )}
    </div>
  );
}
