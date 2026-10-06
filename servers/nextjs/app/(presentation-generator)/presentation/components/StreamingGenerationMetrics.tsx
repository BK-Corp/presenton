"use client";

import type { GenerationMetrics } from "@/store/slices/presentationGeneration";
import { useT } from "@/lib/i18n";

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatTokens = (value: number | null, estimated = false) => {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${estimated ? "~" : ""}${integerFormatter.format(Math.round(value))}`;
};

export default function StreamingGenerationMetrics({
  metrics,
}: {
  metrics: GenerationMetrics;
}) {
  const t = useT();
  const thinkingPending =
    metrics.supports_thinking &&
    metrics.thinking_tokens_estimated &&
    (metrics.thinking_tokens ?? 0) === 0;

  return (
    <div
      aria-live="polite"
      className="hidden h-[38px] shrink-0 items-center rounded-[80px] border border-[#E4E2EB] bg-[#F6F6F9] px-3 font-syne sm:flex"
      title={
        metrics.estimated
          ? t("presentation.metrics.estimated")
          : t("presentation.metrics.finalUsage", {
              model: metrics.model || t("presentation.metrics.defaultModel"),
            })
      }
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold text-[#555766]">
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${
            metrics.estimated ? "animate-pulse bg-[#6847F4]" : "bg-emerald-500"
          }`}
        />
        <span className="whitespace-nowrap">
          {t("presentation.metrics.tokensIn", {
            value: formatTokens(metrics.input_tokens, metrics.estimated),
          })}
        </span>
        <span className="h-3.5 w-px bg-[#D8D8DF]" aria-hidden="true" />
        <span className="whitespace-nowrap">
          {t("presentation.metrics.tokensOut", {
            value: formatTokens(metrics.output_tokens, metrics.estimated),
          })}
        </span>
        {metrics.supports_thinking ? (
          <>
            <span className="h-3.5 w-px bg-[#D8D8DF]" aria-hidden="true" />
            <span
              className={`whitespace-nowrap ${
                thinkingPending ? "animate-pulse text-[#6847F4]" : ""
              }`}
              title={
                thinkingPending
                  ? t("presentation.metrics.thinkingWaiting")
                  : undefined
              }
            >
              {t("presentation.metrics.tokensThink", {
                value: formatTokens(
                  metrics.thinking_tokens,
                  metrics.thinking_tokens_estimated,
                ),
              })}
            </span>
          </>
        ) : null}
        <span className="h-3.5 w-px bg-[#D8D8DF]" aria-hidden="true" />
        <span className="whitespace-nowrap">
          {t("presentation.metrics.tokensPerSecond", {
            value: decimalFormatter.format(metrics.tokens_per_second),
          })}
        </span>
      </div>
    </div>
  );
}
