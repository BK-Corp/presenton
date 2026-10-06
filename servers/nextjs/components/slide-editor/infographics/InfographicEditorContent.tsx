"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ImageIcon,
  Layers3,
  Palette,
  Plus,
  Trash2,
  Type,
  X,
} from "lucide-react";
import IconsEditor from "@/components/slide-editor/images/IconsEditor";
import { ImagePickerModal } from "@/components/slide-editor/images/ImagePickerModal";
import { DeferredColorInput } from "@/components/slide-editor/toolbar/DeferredColorInput";
import type {
  BeforeAfterInfographicData,
  ComparisonMatrixInfographicData,
  DecisionTreeInfographicData,
  GanttInfographicData,
  GanttInfographicItem,
  GanttInfographicPosition,
  ConversionFunnelInfographicData,
  ConversionFunnelInfographicItem,
  InfographicType,
  ImpactEffortMatrixInfographicData,
  ItemCollectionInfographicData,
  MeterInfographicData,
  MindMapInfographicData,
  MindMapInfographicNode,
  OrgChartInfographicData,
  RadialCycleInfographicData,
  PillarFrameworkInfographicData,
  RiskMatrixInfographicData,
  TimelineInfographicItem,
  TransformationHubInfographicData,
  VerticalFunnelInfographicData,
} from "@/components/slide-editor/types";
import {
  appendInfographicColor,
  ganttPositionToUnits,
  moveCollectionItem,
  normalizeGanttItem,
  normalizeInfographicIcon,
  normalizeInfographicColors,
  removeGanttColumn,
  removeInfographicColor,
} from "@/components/slide-editor/infographics/infographic-editing";
import type { TemplateV2InfographicToolbarElement } from "@/components/slide-editor/layout/InfographicToolbarControls";
import { defaultInfographicIcon } from "@/components/slide-editor/infographics/infographic-icons";
import { resizedInfographicFrame } from "@/components/slide-editor/infographics/infographic-sizing";
import { useT } from "@/lib/i18n";
import { buildSvgUpdateUrl } from "@/lib/svg-color";

type RawRecord = Record<string, unknown>;

const TYPE_LABEL_KEYS: Record<InfographicType, string> = {
  progress_bar: "editorTools.infographic.typeProgressBar",
  gauge: "editorTools.infographic.typeGauge",
  gantt: "editorTools.infographic.typeGanttChart",
  timeline: "editorTools.infographic.typeTimeline",
  roadmap: "editorTools.infographic.typeRoadmap",
  milestone_timeline: "editorTools.infographic.typeMilestoneTimeline",
  staircase: "editorTools.infographic.typeStaircase",
  supply_chain: "editorTools.infographic.typeSupplyChain",
  stair_step_blocks: "editorTools.infographic.typeStepBlocks",
  maturity_model: "editorTools.infographic.typeMaturityModel",
  diagonal_circles: "editorTools.infographic.typeDiagonalCircles",
  pillar_framework: "editorTools.infographic.typePillarFramework",
  transformation_hub: "editorTools.infographic.typeTransformationHub",
  risk_matrix: "editorTools.infographic.typeRiskMatrix",
  chevron_process: "editorTools.infographic.typeChevronProcess",
  radial_cycle: "editorTools.infographic.typeRadialCycle",
  conversion_funnel: "editorTools.infographic.typeConversionFunnel",
  vertical_funnel: "editorTools.infographic.typeVerticalFunnel",
  pyramid: "editorTools.infographic.typePyramid",
  segmented_wheel: "editorTools.infographic.typeSegmentedWheel",
  customer_journey: "editorTools.infographic.typeCustomerJourney",
  before_after: "editorTools.infographic.typeBeforeAfter",
  impact_effort_matrix: "editorTools.infographic.typeImpactEffortMatrix",
  comparison_matrix: "editorTools.infographic.typeComparisonMatrix",
  org_chart: "editorTools.infographic.typeOrgChart",
  decision_tree: "editorTools.infographic.typeDecisionTree",
  mind_map: "editorTools.infographic.typeMindMap",
};

const ITEM_LABEL_KEYS: Record<string, string> = {
  stop: "editorTools.infographic.itemStop",
  milestone: "editorTools.infographic.itemMilestone",
  step: "editorTools.infographic.itemStep",
  stage: "editorTools.infographic.itemStage",
  level: "editorTools.infographic.itemLevel",
  pillar: "editorTools.infographic.itemPillar",
  segment: "editorTools.infographic.itemSegment",
  node: "editorTools.infographic.itemNode",
  capability: "editorTools.infographic.itemCapability",
  activity: "editorTools.infographic.itemActivity",
  quadrant: "editorTools.infographic.itemQuadrant",
  row: "editorTools.infographic.itemRow",
  comparison: "editorTools.infographic.itemComparison",
};

export function InfographicDataEditorPopover({
  element,
  onChange,
  onClose,
}: {
  element: TemplateV2InfographicToolbarElement;
  onChange: (element: TemplateV2InfographicToolbarElement) => void;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <InfographicDataEditorContent
      element={element}
      onChange={onChange}
      onClose={onClose}
    />,
    document.body,
  );
}

export function InfographicDataEditorContent({
  element,
  onChange,
  onClose,
}: {
  element: TemplateV2InfographicToolbarElement;
  onChange: (element: TemplateV2InfographicToolbarElement) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TemplateV2InfographicToolbarElement>(
    () => ({ ...element }),
  );
  const t = useT();
  const type = readInfographicType(readRecord(draft.data).type);
  const isMeter = type === "progress_bar" || type === "gauge";
  const colors = normalizeInfographicColors(draft.colors, type);
  const textColor = readColor(
    draft.text_color,
    defaultInfographicTextColor(colors[0]),
  );
  const itemCount = infographicEditorItemCount(draft.data, type);
  const updateData = (data: unknown) => {
    setDraft((current) => {
      const currentData = readRecord(current.data);
      const nextData = readRecord(data);
      return {
        ...current,
        data: {
          ...nextData,
          ...(typeof currentData.card_color === "string"
            ? { card_color: currentData.card_color }
            : {}),
          ...(typeof currentData.background_text_color === "string"
            ? { background_text_color: currentData.background_text_color }
            : {}),
        },
        infographic_type: undefined,
        min_value: undefined,
        max_value: undefined,
        value: undefined,
      };
    });
  };
  const updateColors = (nextColors: string[]) => {
    setDraft((current) => ({
      ...current,
      colors: nextColors,
      base_color: undefined,
      highlight_color: undefined,
    }));
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const saveChanges = () => {
    onChange({
      ...draft,
      ...resizedInfographicFrame(element, draft.data),
      colors: normalizeInfographicColors(draft.colors, type),
    });
    onClose();
  };

  return (
    <div
      data-inline-edit-ignore="true"
      className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/35 p-4 pr-[72px] font-syne"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        aria-describedby="infographic-editor-description"
        aria-labelledby="infographic-editor-title"
        aria-modal="true"
        className="relative flex w-full max-w-[1080px] flex-col overflow-visible"
        role="dialog"
        style={{
          height: "min(650px, calc(100dvh - 32px))",
          maxHeight: "min(650px, calc(100dvh - 32px))",
        }}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(16,24,40,0.24)]">
          <header className="flex h-[70px] shrink-0 items-center justify-between border-b border-[#ECECF1] px-5">
            <div>
              <h2
                id="infographic-editor-title"
                className="text-[15px] font-semibold text-[#191919]"
              >
                {t("editorTools.infographic.title")}
              </h2>
              <p
                id="infographic-editor-description"
                className="mt-1 text-[11px] text-[#8B8B94]"
              >
                {t(TYPE_LABEL_KEYS[type])}
                {!isMeter && itemCount > 0
                  ? ` · ${t(
                      itemCount === 1
                        ? "editorTools.infographic.itemCountOne"
                        : "editorTools.infographic.itemCountMany",
                      { count: itemCount },
                    )}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 min-w-[76px] rounded-full bg-[linear-gradient(100deg,#FFE6A6_0%,#D8B4FE_100%)] px-5 text-[12px] font-semibold text-[#191919] transition hover:brightness-95"
                onClick={saveChanges}
              >
                {t("common.save")}
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            <aside className="min-h-0 w-[255px] shrink-0 overflow-y-auto overscroll-contain border-r border-[#ECECF1] px-4 py-4 hide-scrollbar">
              <label className="mb-2 block text-[12px] font-medium text-[#191919]">
                {t("editorTools.infographic.appearance")}
              </label>

              <div className="rounded-lg border border-[#ECECF1] bg-[#F8F8FA] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-medium text-[#191919]">
                      {t("editorTools.infographic.colorPalette")}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#8B8B94]">
                      {t("editorTools.infographic.colorPaletteHint")}
                    </p>
                  </div>
                  <Layers3 size={14} className="text-[#7C51F8]" />
                </div>
                <ColorEditor
                  colors={colors}
                  meter={isMeter}
                  onChange={updateColors}
                />
              </div>

              <div className="mt-3 rounded-lg border border-[#ECECF1] bg-white p-3">
                <div className="mb-3 flex items-center gap-2">
                  <Type size={14} className="text-[#191919]" />
                  <div>
                    <p className="text-[12px] font-medium text-[#191919]">
                      {t("editorTools.infographic.textColor")}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#8B8B94]">
                      {t("editorTools.infographic.textColorHint")}
                    </p>
                  </div>
                </div>
                <DeferredColorInput
                  aria-label={t("editorTools.infographic.textColorAria")}
                  className="h-8 w-full cursor-pointer rounded-lg border border-[#E6E6EA] bg-white p-1"
                  value={textColor}
                  onCommit={(text_color) =>
                    setDraft((current) => ({ ...current, text_color }))
                  }
                />
              </div>

              <div className="mt-3 flex gap-2 rounded-lg border border-[#ECECF1] bg-[#F8F8FA] p-3 text-[10px] leading-4 text-[#686873]">
                <Palette size={14} className="mt-0.5 shrink-0 text-[#7C51F8]" />
                <span>{t("editorTools.infographic.backgroundHint")}</span>
              </div>
            </aside>

            <main className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain px-8 py-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#191919]">
                    {t("editorTools.infographic.content")}
                  </h3>
                  <p className="mt-1 text-[11px] text-[#8B8B94]">
                    {t("editorTools.infographic.contentHint")}
                  </p>
                </div>
                {!isMeter && itemCount > 0 ? (
                  <span className="rounded-full border border-[#E6E6EA] bg-white px-3 py-1 text-[11px] font-medium text-[#686873]">
                    {t(
                      itemCount === 1
                        ? "editorTools.infographic.itemCountOne"
                        : "editorTools.infographic.itemCountMany",
                      { count: itemCount },
                    )}
                  </span>
                ) : null}
              </div>

              {type === "progress_bar" || type === "gauge" ? (
                <MeterEditor
                  data={readMeterData(draft.data, type)}
                  onChange={updateData}
                />
              ) : null}
              {type === "gantt" ? (
                <GanttEditor
                  data={readGanttData(draft.data)}
                  onChange={updateData}
                />
              ) : null}
              {type === "timeline" ||
              type === "roadmap" ||
              type === "milestone_timeline" ||
              type === "staircase" ||
              type === "supply_chain" ||
              type === "stair_step_blocks" ||
              type === "maturity_model" ||
              type === "diagonal_circles" ||
              type === "chevron_process" ||
              type === "segmented_wheel" ||
              type === "customer_journey" ||
              type === "pyramid" ? (
                <TimelineEditor
                  data={readItemCollectionData(draft.data, type)}
                  onChange={updateData}
                />
              ) : null}
              {type === "radial_cycle" ? (
                <RadialCycleEditor
                  data={readRadialCycleData(draft.data)}
                  onChange={updateData}
                />
              ) : null}
              {type === "conversion_funnel" ? (
                <FunnelEditor
                  data={readConversionFunnelData(draft.data)}
                  onChange={updateData}
                />
              ) : null}
              {type === "vertical_funnel" ? (
                <FunnelEditor
                  data={readVerticalFunnelData(draft.data)}
                  onChange={updateData}
                />
              ) : null}
              {type === "before_after" ? (
                <BeforeAfterEditor
                  data={readBeforeAfterData(draft.data)}
                  onChange={updateData}
                />
              ) : null}
              {type === "impact_effort_matrix" ? (
                <ImpactEffortEditor
                  data={readImpactEffortData(draft.data)}
                  onChange={updateData}
                />
              ) : null}
              {type === "comparison_matrix" ? (
                <ComparisonMatrixEditor
                  data={readComparisonMatrixData(draft.data)}
                  onChange={updateData}
                />
              ) : null}
              {type === "pillar_framework" ? (
                <PillarFrameworkEditor
                  data={readPillarFrameworkData(draft.data)}
                  onChange={updateData}
                />
              ) : null}
              {type === "transformation_hub" ? (
                <TransformationHubEditor
                  data={readTransformationHubData(draft.data)}
                  onChange={updateData}
                />
              ) : null}
              {type === "risk_matrix" ? (
                <RiskMatrixEditor
                  data={readRiskMatrixData(draft.data)}
                  onChange={updateData}
                />
              ) : null}
              {type === "org_chart" || type === "decision_tree" ? (
                <HierarchyEditor
                  data={readHierarchyData(draft.data, type)}
                  onChange={updateData}
                />
              ) : null}
              {type === "mind_map" ? (
                <MindMapEditor
                  data={readMindMapData(draft.data)}
                  onChange={updateData}
                />
              ) : null}
            </main>
          </div>
        </div>

        <button
          type="button"
          aria-label={t("editorTools.infographic.closeAria")}
          className="absolute -right-14 top-0 grid h-11 w-11 place-items-center rounded-full bg-white text-[#191919] shadow-sm transition hover:bg-[#F7F7FA]"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

function ColorEditor({
  colors,
  meter,
  onChange,
}: {
  colors: string[];
  meter: boolean;
  onChange: (colors: string[]) => void;
}) {
  const t = useT();
  const firstEditableIndex = meter ? 0 : 1;
  const editableColors = colors.slice(firstEditableIndex);

  return (
    <div>
      <div className="space-y-2">
        {editableColors.map((color, visibleIndex) => {
          const index = visibleIndex + firstEditableIndex;
          const canMoveUp = visibleIndex > 0;
          const canMoveDown = visibleIndex < editableColors.length - 1;
          return (
            <div
              key={`infographic-color-${index}`}
              className="group flex items-center gap-2 rounded-lg border border-[#E6E6EA] bg-white p-1.5 transition hover:border-[#CDBCFB]"
            >
              <DeferredColorInput
                aria-label={
                  meter && index === 0
                    ? t("editorTools.infographic.trackColorAria")
                    : meter && index === 1
                      ? t("editorTools.infographic.progressColorAria")
                      : t("editorTools.infographic.paletteColorAria", {
                          n: visibleIndex + 1,
                        })
                }
                className="h-8 w-9 shrink-0 cursor-pointer rounded-lg border border-[#E6E6EA] bg-white p-1"
                value={color}
                onCommit={(nextColor) =>
                  onChange(
                    colors.map((current, colorIndex) =>
                      colorIndex === index ? nextColor : current,
                    ),
                  )
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-medium text-[#191919]">
                  {meter && index === 0
                    ? t("editorTools.infographic.track")
                    : meter && index === 1
                      ? t("editorTools.infographic.progress")
                      : t("editorTools.infographic.colorN", {
                          n: visibleIndex + 1,
                        })}
                </span>
                <span className="mt-0.5 block font-mono text-[8px] uppercase text-[#8B8B94]">
                  #{color.replace(/^#/, "")}
                </span>
              </span>
              <div className="flex items-center opacity-60 transition group-hover:opacity-100">
                <MiniButton
                  label={t("editorTools.infographic.moveColorUp")}
                  disabled={!canMoveUp}
                  onClick={() => onChange(moveCollectionItem(colors, index, -1))}
                >
                  <ChevronUp size={13} />
                </MiniButton>
                <MiniButton
                  label={t("editorTools.infographic.moveColorDown")}
                  disabled={!canMoveDown}
                  onClick={() => onChange(moveCollectionItem(colors, index, 1))}
                >
                  <ChevronDown size={13} />
                </MiniButton>
                <MiniButton
                  label={t("editorTools.infographic.deleteColor")}
                  disabled={editableColors.length <= (meter ? 2 : 1)}
                  onClick={() => onChange(removeInfographicColor(colors, index))}
                >
                  <Trash2 size={13} />
                </MiniButton>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#B8A3F8] bg-white text-[10px] font-medium text-[#7C51F8] outline-none transition hover:bg-[#F8F5FF] focus-visible:ring-2 focus-visible:ring-[#D8CEFA]"
        onClick={() => onChange(appendInfographicColor(colors))}
      >
        <Plus size={13} />
        {t("editorTools.infographic.addPaletteColor")}
      </button>
    </div>
  );
}

function MeterEditor({
  data,
  onChange,
}: {
  data: MeterInfographicData;
  onChange: (data: MeterInfographicData) => void;
}) {
  const t = useT();
  return (
    <EditorSection
      title={t("editorTools.infographic.valuesTitle")}
      description={t("editorTools.infographic.valuesDescription")}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumberInput
          label={t("editorTools.infographic.minimum")}
          value={data.min_value}
          onChange={(min_value) => onChange({ ...data, min_value })}
        />
        <NumberInput
          label={t("editorTools.infographic.maximum")}
          value={data.max_value}
          onChange={(max_value) => onChange({ ...data, max_value })}
        />
        <NumberInput
          label={t("editorTools.infographic.value")}
          value={data.value}
          onChange={(value) => onChange({ ...data, value })}
        />
      </div>
    </EditorSection>
  );
}

function GanttEditor({
  data,
  onChange,
}: {
  data: GanttInfographicData;
  onChange: (data: GanttInfographicData) => void;
}) {
  const t = useT();
  const setRows = (rows: GanttInfographicData["rows"]) =>
    onChange({ ...data, rows });
  const [expandedRowIndex, setExpandedRowIndex] = useState<number | null>(() =>
    data.rows.length > 0 ? 0 : null,
  );
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const pendingRowScrollIndexRef = useRef<number | null>(null);
  const taskRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingTaskScrollKeyRef = useRef<string | null>(null);
  const taskCount = data.rows.reduce(
    (count, row) => count + (row.items?.length ?? 0),
    0,
  );

  useEffect(() => {
    const index = pendingRowScrollIndexRef.current;
    if (index == null || index >= data.rows.length) return;
    pendingRowScrollIndexRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      rowRefs.current.get(index)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [data.rows.length]);

  useEffect(() => {
    const key = pendingTaskScrollKeyRef.current;
    if (!key) return;
    pendingTaskScrollKeyRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      taskRefs.current.get(key)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [taskCount]);

  const addRow = () => {
    const nextIndex = data.rows.length;
    pendingRowScrollIndexRef.current = nextIndex;
    setExpandedRowIndex(nextIndex);
    setRows([
      ...data.rows,
      {
        label: t("editorTools.infographic.rowN", { n: data.rows.length + 1 }),
        items: [defaultGanttItem(data.columns.length)],
      },
    ]);
  };

  const moveRow = (rowIndex: number, direction: -1 | 1) => {
    const targetIndex = rowIndex + direction;
    setExpandedRowIndex((current) => {
      if (current === rowIndex) return targetIndex;
      if (current === targetIndex) return rowIndex;
      return current;
    });
    setRows(moveCollectionItem(data.rows, rowIndex, direction));
  };

  const deleteRow = (rowIndex: number) => {
    setExpandedRowIndex((current) => {
      if (current == null) return null;
      if (current === rowIndex) {
        return data.rows.length > 1
          ? Math.min(rowIndex, data.rows.length - 2)
          : null;
      }
      return current > rowIndex ? current - 1 : current;
    });
    setRows(data.rows.filter((_, index) => index !== rowIndex));
  };

  const addTask = (rowIndex: number) => {
    const nextTaskIndex = data.rows[rowIndex]?.items?.length ?? 0;
    pendingTaskScrollKeyRef.current = `${rowIndex}-${nextTaskIndex}`;
    setRows(
      data.rows.map((current, index) =>
        index === rowIndex
          ? {
              ...current,
              items: [
                ...(current.items ?? []),
                defaultGanttItem(data.columns.length),
              ],
            }
          : current,
      ),
    );
  };

  return (
    <div className="space-y-5">
      <EditorSection
        title={t("editorTools.infographic.columnsTitle")}
        description={t("editorTools.infographic.columnsDescription", {
          count: data.columns.length,
        })}
        action={
          <AddButton
            compact
            label={t("editorTools.infographic.addColumn")}
            onClick={() =>
              onChange({
                ...data,
                columns: [
                  ...data.columns,
                  {
                    label: t("editorTools.infographic.columnN", {
                      n: data.columns.length + 1,
                    }),
                  },
                ],
              })
            }
          />
        }
      >
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(155px,1fr))]">
          {data.columns.map((column, index) => (
            <div
              key={`gantt-column-${index}`}
              className="rounded-xl border border-[#E5E6EB] bg-[#FAFAFC] p-2.5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-[#F1ECFF] text-[10px] font-semibold text-[#7C51F8]">
                  {index + 1}
                </span>
                <div className="flex items-center gap-0.5">
                  <MiniButton
                    label={t("editorTools.infographic.moveColumnLeft")}
                    disabled={index === 0}
                    onClick={() =>
                      onChange({
                        ...data,
                        columns: moveCollectionItem(data.columns, index, -1),
                      })
                    }
                  >
                    <ChevronLeft size={13} />
                  </MiniButton>
                  <MiniButton
                    label={t("editorTools.infographic.moveColumnRight")}
                    disabled={index === data.columns.length - 1}
                    onClick={() =>
                      onChange({
                        ...data,
                        columns: moveCollectionItem(data.columns, index, 1),
                      })
                    }
                  >
                    <ChevronRight size={13} />
                  </MiniButton>
                  <MiniButton
                    label={t("editorTools.infographic.deleteColumn")}
                    disabled={data.columns.length <= 1}
                    onClick={() => onChange(removeGanttColumn(data, index))}
                  >
                    <Trash2 size={13} />
                  </MiniButton>
                </div>
              </div>
              <TextInput
                ariaLabel={t("editorTools.infographic.columnN", {
                  n: index + 1,
                })}
                value={column.label}
                onChange={(label) =>
                  onChange({
                    ...data,
                    columns: data.columns.map((current, columnIndex) =>
                      columnIndex === index ? { ...current, label } : current,
                    ),
                  })
                }
              />
            </div>
          ))}
        </div>
      </EditorSection>

      <EditorSection
        title={t("editorTools.infographic.rowsTasksTitle")}
        description={t("editorTools.infographic.rowsDescription", {
          count: data.rows.length,
        })}
        action={
          <AddButton
            compact
            label={t("editorTools.infographic.addRow")}
            onClick={addRow}
          />
        }
      >
        <div className="space-y-3.5">
          {data.rows.map((row, rowIndex) => {
            const rowItems = row.items ?? [];
            const isExpanded = expandedRowIndex === rowIndex;
            const rowPanelId = `gantt-row-${rowIndex}-editor`;
            return (
              <div
                key={`gantt-row-${rowIndex}`}
                ref={(node) => {
                  if (node) rowRefs.current.set(rowIndex, node);
                  else rowRefs.current.delete(rowIndex);
                }}
                className="rounded-xl border border-[#ECECF1] bg-white p-4"
              >
                <div
                  className={`flex items-center justify-between gap-3 ${
                    isExpanded ? "border-b border-[#EFEFF3] pb-3" : ""
                  }`}
                >
                  <button
                    type="button"
                    aria-controls={rowPanelId}
                    aria-expanded={isExpanded}
                    aria-label={t(
                      isExpanded
                        ? "editorTools.infographic.collapseRowAria"
                        : "editorTools.infographic.expandRowAria",
                      { n: rowIndex + 1 },
                    )}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[#D8CEFA]"
                    onClick={() =>
                      setExpandedRowIndex((current) =>
                        current === rowIndex ? null : rowIndex,
                      )
                    }
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#F1ECFF] text-[11px] font-semibold text-[#7C51F8]">
                      {rowIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-semibold text-[#191919]">
                        {row.label ||
                          t("editorTools.infographic.rowN", {
                            n: rowIndex + 1,
                          })}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-[#8B8B94]">
                        {t(
                          rowItems.length === 1
                            ? "editorTools.infographic.taskCountOne"
                            : "editorTools.infographic.taskCountMany",
                          { count: rowItems.length },
                        )}
                      </span>
                    </span>
                    {isExpanded ? (
                      <ChevronDown size={15} className="shrink-0 text-[#777781]" />
                    ) : (
                      <ChevronRight size={15} className="shrink-0 text-[#777781]" />
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <MoveButtons
                      index={rowIndex}
                      length={data.rows.length}
                      label={t("editorTools.infographic.itemRow")}
                      onMove={(direction) => moveRow(rowIndex, direction)}
                    />
                    <MiniButton
                      label={t("editorTools.infographic.deleteRow")}
                      disabled={data.rows.length <= 1}
                      onClick={() => deleteRow(rowIndex)}
                    >
                      <Trash2 size={14} />
                    </MiniButton>
                  </div>
                </div>

                {isExpanded ? (
                  <div id={rowPanelId} className="mt-4">
                    <div className="flex items-end gap-3">
                      <LabeledField
                        className="min-w-0 flex-1"
                        label={t("editorTools.infographic.rowLabel")}
                      >
                        <TextInput
                          ariaLabel={t("editorTools.infographic.rowLabelAria", {
                            n: rowIndex + 1,
                          })}
                          className="font-semibold"
                          value={row.label}
                          onChange={(label) =>
                            setRows(
                              data.rows.map((current, index) =>
                                index === rowIndex
                                  ? { ...current, label }
                                  : current,
                              ),
                            )
                          }
                        />
                      </LabeledField>
                      <AddButton
                        compact
                        label={t("editorTools.infographic.addTask")}
                        onClick={() => addTask(rowIndex)}
                      />
                    </div>

                    <div className="mt-3 space-y-3">
                      {rowItems.map((item, itemIndex) => (
                        <div
                          key={`gantt-row-${rowIndex}-item-${itemIndex}`}
                          ref={(node) => {
                            const key = `${rowIndex}-${itemIndex}`;
                            if (node) taskRefs.current.set(key, node);
                            else taskRefs.current.delete(key);
                          }}
                        >
                          <GanttTaskEditor
                            columnCount={data.columns.length}
                            columns={data.columns}
                            item={item}
                            taskIndex={itemIndex}
                            onChange={(nextItem) =>
                              setRows(
                                data.rows.map((current, index) =>
                                  index === rowIndex
                                    ? {
                                        ...current,
                                        items: (current.items ?? []).map(
                                          (currentItem, index) =>
                                            index === itemIndex
                                              ? nextItem
                                              : currentItem,
                                        ),
                                      }
                                    : current,
                                ),
                              )
                            }
                            onDelete={() =>
                              setRows(
                                data.rows.map((current, index) =>
                                  index === rowIndex
                                    ? {
                                        ...current,
                                        items: (current.items ?? []).filter(
                                          (_, index) => index !== itemIndex,
                                        ),
                                      }
                                    : current,
                                ),
                              )
                            }
                          />
                        </div>
                      ))}
                      {rowItems.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[#DCDDDF] bg-[#FAFAFC] px-4 py-6 text-center text-[11px] text-[#8B8B94]">
                          {t("editorTools.infographic.emptyRowHint")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </EditorSection>
    </div>
  );
}

function GanttTaskEditor({
  columnCount,
  columns,
  item,
  taskIndex,
  onChange,
  onDelete,
}: {
  columnCount: number;
  columns: GanttInfographicData["columns"];
  item: GanttInfographicItem;
  taskIndex: number;
  onChange: (item: GanttInfographicItem) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const commit = (next: GanttInfographicItem) =>
    onChange(normalizeGanttItem(next, columnCount));
  return (
    <div className="overflow-hidden rounded-xl border border-[#E3E4E9] bg-[#FAFAFC]">
      <div className="flex items-center justify-between border-b border-[#EAEBEF] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-white text-[10px] font-semibold text-[#7C51F8]">
            {taskIndex + 1}
          </span>
          <span className="text-[11px] font-semibold text-[#555560]">
            {t("editorTools.infographic.taskN", { n: taskIndex + 1 })}
          </span>
        </div>
        <MiniButton label={t("editorTools.infographic.deleteTask")} onClick={onDelete}>
          <Trash2 size={13} />
        </MiniButton>
      </div>
      <div className="p-3">
        <LabeledField label={t("editorTools.infographic.taskName")}>
          <TextInput
            ariaLabel={t("editorTools.infographic.taskNameAria", {
              n: taskIndex + 1,
            })}
            value={item.name}
            onChange={(name) => commit({ ...item, name })}
          />
        </LabeledField>
        <GanttTaskRangePreview
          columnCount={columnCount}
          columns={columns}
          item={item}
        />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GanttPositionEditor
            label={t("editorTools.layout.start")}
            columns={columns}
            value={item.start}
            onChange={(start) => commit({ ...item, start })}
          />
          <GanttPositionEditor
            label={t("editorTools.layout.end")}
            columns={columns}
            value={item.end}
            onChange={(end) => commit({ ...item, end })}
          />
        </div>
      </div>
    </div>
  );
}

function GanttTaskRangePreview({
  columnCount,
  columns,
  item,
}: {
  columnCount: number;
  columns: GanttInfographicData["columns"];
  item: GanttInfographicItem;
}) {
  const t = useT();
  const count = Math.max(1, columnCount);
  const startUnits = Math.min(count, Math.max(0, ganttPositionToUnits(item.start)));
  const endUnits = Math.min(count, Math.max(startUnits, ganttPositionToUnits(item.end)));
  const left = (startUnits / count) * 100;
  const width = Math.max(1.5, ((endUnits - startUnits) / count) * 100);
  const startLabel =
    columns[item.start.column]?.label ||
    t("editorTools.infographic.columnN", { n: item.start.column + 1 });
  const endLabel =
    columns[item.end.column]?.label ||
    t("editorTools.infographic.columnN", { n: item.end.column + 1 });

  return (
    <div className="mt-3 rounded-xl border border-[#E5E6EB] bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3 text-[10px]">
        <span className="font-medium text-[#686873]">
          {t("editorTools.infographic.schedulePreview")}
        </span>
        <span className="truncate text-[#8B8B94]">
          {startLabel} → {endLabel}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-[#ECEEF3]">
        <span
          className="absolute inset-y-0 rounded-full bg-[#7C51F8]"
          style={{ left: `${left}%`, width: `${Math.min(100 - left, width)}%` }}
        />
      </div>
    </div>
  );
}

function GanttPositionEditor({
  columns,
  label,
  value,
  onChange,
}: {
  columns: GanttInfographicData["columns"];
  label: string;
  value: GanttInfographicPosition;
  onChange: (value: GanttInfographicPosition) => void;
}) {
  const t = useT();
  const offset = value.offset ?? 0;
  return (
    <div className="rounded-xl border border-[#E5E6EB] bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#555560]">{label}</span>
        <span className="rounded-full bg-[#F1ECFF] px-2 py-0.5 text-[9px] font-semibold text-[#7C51F8]">
          {Math.round(offset * 100)}%
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_120px]">
        <LabeledField label={t("editorTools.infographic.columnLabel")}>
          <select
            aria-label={t("editorTools.infographic.columnAria", { label })}
            className={inputClassName}
            value={Math.min(columns.length - 1, Math.max(0, value.column))}
            onChange={(event) =>
              onChange({ ...value, column: Number(event.target.value) })
            }
          >
            {columns.map((column, index) => (
              <option key={`${label}-column-${index}`} value={index}>
                {column.label ||
                  t("editorTools.infographic.columnN", { n: index + 1 })}
              </option>
            ))}
          </select>
        </LabeledField>
        <LabeledField label={t("editorTools.infographic.positionPercent")}>
          <NumberInput
            compact
            label={t("editorTools.infographic.positionPercentAria", { label })}
            max={100}
            min={0}
            step={5}
            value={Math.round(offset * 100)}
            onChange={(percentage) =>
              onChange({ ...value, offset: percentage / 100 })
            }
          />
        </LabeledField>
      </div>
    </div>
  );
}

function TimelineEditor({
  data,
  onChange,
}: {
  data: ItemCollectionInfographicData;
  onChange: (data: ItemCollectionInfographicData) => void;
}) {
  const t = useT();
  const latestMilestone = Number(data.items.at(-1)?.heading);
  const config = (() => {
    switch (data.type) {
      case "roadmap":
        return {
          itemLabel: "stop",
          description: t("editorTools.infographic.roadmapDescription"),
          heading: t("editorTools.infographic.newStop", {
            n: data.items.length + 1,
          }),
          showIcons: false,
        };
      case "milestone_timeline":
        return {
          itemLabel: "milestone",
          description: t("editorTools.infographic.milestoneDescription"),
          heading: Number.isFinite(latestMilestone)
            ? String(latestMilestone + 1)
            : t("editorTools.infographic.newMilestone", {
                n: data.items.length + 1,
              }),
          showIcons: false,
        };
      case "staircase":
        return {
          itemLabel: "step",
          description: t("editorTools.infographic.staircaseDescription"),
          heading: t("editorTools.infographic.newStep", {
            n: data.items.length + 1,
          }),
          showIcons: true,
        };
      case "supply_chain":
        return {
          itemLabel: "stage",
          description: t("editorTools.infographic.supplyChainDescription"),
          heading: t("editorTools.infographic.newStage", {
            n: data.items.length + 1,
          }),
          showIcons: true,
        };
      case "stair_step_blocks":
        return {
          itemLabel: "step",
          description: t("editorTools.infographic.stepBlocksDescription"),
          heading: t("editorTools.infographic.newStep", {
            n: String(data.items.length + 1).padStart(2, "0"),
          }),
          showIcons: true,
        };
      case "maturity_model":
        return {
          itemLabel: "level",
          description: t("editorTools.infographic.maturityDescription"),
          heading: t("editorTools.infographic.newLevel", {
            n: data.items.length + 1,
          }),
          showIcons: true,
        };
      case "diagonal_circles":
        return {
          itemLabel: "pillar",
          description: t("editorTools.infographic.diagonalCirclesDescription"),
          heading: t("editorTools.infographic.newPillar", {
            n: data.items.length + 1,
          }),
          showIcons: true,
        };
      case "chevron_process":
        return {
          itemLabel: "stage",
          description: t("editorTools.infographic.chevronDescription"),
          heading: t("editorTools.infographic.newStage", {
            n: data.items.length + 1,
          }),
          showIcons: false,
        };
      case "pyramid":
        return {
          itemLabel: "level",
          description: t("editorTools.infographic.pyramidDescription"),
          heading: t("editorTools.infographic.newLevel", {
            n: data.items.length + 1,
          }),
          showIcons: true,
        };
      case "segmented_wheel":
        return {
          itemLabel: "segment",
          description: t("editorTools.infographic.segmentedWheelDescription"),
          heading: t("editorTools.infographic.newSegment", {
            n: data.items.length + 1,
          }),
          showIcons: true,
        };
      case "customer_journey":
        return {
          itemLabel: "stage",
          description: t("editorTools.infographic.customerJourneyDescription"),
          heading:
            data.items.length === 0
              ? ""
              : t("editorTools.infographic.newStage", {
                  n: data.items.length,
                }),
          showIcons: true,
        };
      default:
        return {
          itemLabel: "step",
          description: t("editorTools.infographic.timelineDefaultDescription"),
          heading: t("editorTools.infographic.newStep", {
            n: data.items.length + 1,
          }),
          showIcons: true,
        };
    }
  })();
  const hidesEmptyJourneyStart =
    data.type === "customer_journey" &&
    data.items.length > 0 &&
    !data.items[0]?.heading?.trim() &&
    !data.items[0]?.description?.trim();
  const editableItems = hidesEmptyJourneyStart
    ? data.items.slice(1)
    : data.items;
  const hiddenItemCount = data.items.length - editableItems.length;
  return (
    <ItemCollectionEditor
      description={config.description}
      itemLabel={config.itemLabel}
      items={editableItems}
      maxItems={
        data.type === "pyramid"
          ? 4
          : data.type === "segmented_wheel" || data.type === "customer_journey"
            ? 6 - hiddenItemCount
            : 8
      }
      minItems={
        data.type === "pyramid"
          ? 3
          : data.type === "segmented_wheel"
            ? 3
            : data.type === "customer_journey"
              ? 4 - hiddenItemCount
              : 1
      }
      showIcons={config.showIcons}
      onChange={(items) =>
        onChange({
          ...data,
          items: hidesEmptyJourneyStart
            ? [data.items[0], ...items]
            : items,
        })
      }
      onCreate={() => ({
        icon: config.showIcons
          ? defaultInfographicIcon(data.items.length)
          : null,
        heading: config.heading,
        description: t("editorTools.infographic.defaultItemDescription"),
      })}
    />
  );
}

function RadialCycleEditor({
  data,
  onChange,
}: {
  data: RadialCycleInfographicData;
  onChange: (data: RadialCycleInfographicData) => void;
}) {
  const t = useT();
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  return (
    <div className="space-y-4">
      <EditorSection
        title={t("editorTools.infographic.centerImageTitle")}
        description={t("editorTools.infographic.centerImageDescription")}
      >
        <button
          type="button"
          className="flex w-full items-center gap-4 rounded-lg border border-[#ECECF1] bg-[#F8F8FA] p-3 text-left outline-none transition hover:border-[#B8A3F8] focus-visible:ring-2 focus-visible:ring-[#D8CEFA]"
          onClick={() => setImagePickerOpen(true)}
        >
          <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-[#E9ECF2]">
            {data.center_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="h-full w-full object-cover"
                src={data.center_image}
              />
            ) : (
              <ImageIcon className="size-7 text-[#777781]" />
            )}
          </span>
          <span>
            <span className="block text-[12px] font-semibold text-[#191919]">
              {data.center_image
                ? t("editorTools.infographic.changeCenterImage")
                : t("editorTools.infographic.addCenterImage")}
            </span>
            <span className="mt-1 block text-[10px] leading-4 text-[#8B8B94]">
              {t("editorTools.infographic.centerImageHint")}
            </span>
          </span>
        </button>
      </EditorSection>
      <ItemCollectionEditor
        description={t("editorTools.infographic.cycleStagesDescription")}
        itemLabel="stage"
        items={data.items}
        maxItems={8}
        onChange={(items) => onChange({ ...data, items })}
        onCreate={() => ({
          heading: t("editorTools.infographic.newStage", {
            n: data.items.length + 1,
          }),
          description: t("editorTools.infographic.defaultItemDescription"),
        })}
        showIcons={false}
      />
      <ImagePickerModal
        currentImage={data.center_image}
        initialPrompt="business team meeting"
        open={imagePickerOpen}
        onClose={() => setImagePickerOpen(false)}
        onSelect={(center_image) => {
          onChange({ ...data, center_image });
          setImagePickerOpen(false);
        }}
      />
    </div>
  );
}

function FunnelEditor({
  data,
  onChange,
}: {
  data: ConversionFunnelInfographicData | VerticalFunnelInfographicData;
  onChange: (
    data: ConversionFunnelInfographicData | VerticalFunnelInfographicData,
  ) => void;
}) {
  const t = useT();
  return (
    <ItemCollectionEditor<ConversionFunnelInfographicItem>
      description={t("editorTools.infographic.funnelDescription")}
      itemLabel="stage"
      items={data.items}
      maxItems={8}
      onChange={(items) => onChange({ ...data, items })}
      onCreate={() => ({
        value: Math.max(0, (data.items.at(-1)?.value ?? 60) - 10),
        heading: t("editorTools.infographic.newStage", {
          n: data.items.length + 1,
        }),
        description: t("editorTools.infographic.defaultItemDescription"),
      })}
      showIcons={false}
      showValue
    />
  );
}

function BeforeAfterEditor({
  data,
  onChange,
}: {
  data: BeforeAfterInfographicData;
  onChange: (data: BeforeAfterInfographicData) => void;
}) {
  const t = useT();
  const [expandedRow, setExpandedRow] = useState<number | null>(0);
  const [editingIconIndex, setEditingIconIndex] = useState<number | null>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const pendingScrollRowRef = useRef<number | null>(null);
  const pairs = Array.from(
    { length: Math.floor(data.items.length / 2) },
    (_, rowIndex) => [
      data.items[rowIndex * 2],
      data.items[rowIndex * 2 + 1],
    ] as [TimelineInfographicItem, TimelineInfographicItem],
  );

  useEffect(() => {
    const rowIndex = pendingScrollRowRef.current;
    if (rowIndex == null || rowIndex >= pairs.length) return;
    pendingScrollRowRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      rowRefs.current.get(rowIndex)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pairs.length]);

  const updatePairItem = (
    rowIndex: number,
    sideIndex: 0 | 1,
    fields: Partial<TimelineInfographicItem>,
  ) => {
    const itemIndex = rowIndex * 2 + sideIndex;
    onChange({
      ...data,
      items: data.items.map((item, index) =>
        index === itemIndex ? { ...item, ...fields } : item,
      ),
    });
  };

  const addPair = () => {
    const nextRow = pairs.length;
    pendingScrollRowRef.current = nextRow;
    setExpandedRow(nextRow);
    onChange({
      ...data,
      items: [
        ...data.items,
        {
          icon: defaultInfographicIcon(data.items.length),
          heading: t("editorTools.infographic.beforeN", { n: nextRow + 1 }),
          description: t("editorTools.infographic.defaultItemDescription"),
        },
        {
          icon: defaultInfographicIcon(data.items.length + 1),
          heading: t("editorTools.infographic.afterN", { n: nextRow + 1 }),
          description: t("editorTools.infographic.defaultItemDescription"),
        },
      ],
    });
  };

  const movePair = (rowIndex: number, direction: -1 | 1) => {
    const nextPairs = moveCollectionItem(pairs, rowIndex, direction);
    setExpandedRow(rowIndex + direction);
    setEditingIconIndex(null);
    onChange({ ...data, items: nextPairs.flat() });
  };

  const deletePair = (rowIndex: number) => {
    setExpandedRow((current) => {
      if (current == null) return null;
      if (current === rowIndex) return pairs.length > 1 ? Math.min(rowIndex, pairs.length - 2) : null;
      return current > rowIndex ? current - 1 : current;
    });
    setEditingIconIndex(null);
    onChange({
      ...data,
      items: data.items.filter((_, index) => Math.floor(index / 2) !== rowIndex),
    });
  };

  const editingItem = editingIconIndex == null ? null : data.items[editingIconIndex] ?? null;

  return (
    <div className="space-y-4">
      <EditorSection
        title={t("editorTools.infographic.columnLabelsTitle")}
        description={t("editorTools.infographic.columnLabelsDescription")}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LabeledField label={t("editorTools.infographic.beforeLabel")}>
            <TextInput
              ariaLabel={t("editorTools.infographic.beforeLabelAria")}
              value={data.before_label ?? t("editorTools.infographic.before")}
              onChange={(before_label) => onChange({ ...data, before_label })}
            />
          </LabeledField>
          <LabeledField label={t("editorTools.infographic.afterLabel")}>
            <TextInput
              ariaLabel={t("editorTools.infographic.afterLabelAria")}
              value={data.after_label ?? t("editorTools.infographic.after")}
              onChange={(after_label) => onChange({ ...data, after_label })}
            />
          </LabeledField>
        </div>
      </EditorSection>

      <EditorSection
        title={t("editorTools.infographic.comparisonRowsTitle")}
        description={t("editorTools.infographic.comparisonRowsDescription")}
        action={
          <AddButton
            compact
            disabled={pairs.length >= 5}
            label={t("editorTools.infographic.addRow")}
            onClick={addPair}
          />
        }
      >
        <div className="space-y-3">
          {pairs.map((pair, rowIndex) => {
            const expanded = expandedRow === rowIndex;
            return (
              <div
                key={`comparison-row-${rowIndex}`}
                ref={(node) => {
                  if (node) rowRefs.current.set(rowIndex, node);
                  else rowRefs.current.delete(rowIndex);
                }}
                className="rounded-xl border border-[#ECECF1] bg-white p-4"
              >
                <div className={`flex items-center justify-between gap-3 ${expanded ? "border-b border-[#EFEFF3] pb-3" : ""}`}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[#D8CEFA]"
                    onClick={() => setExpandedRow((current) => current === rowIndex ? null : rowIndex)}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#F1ECFF] text-[11px] font-semibold text-[#7C51F8]">
                      {rowIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-semibold text-[#191919]">
                        {t("editorTools.infographic.comparisonN", {
                          n: rowIndex + 1,
                        })}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-[#8B8B94]">
                        {pair[0].heading || t("editorTools.infographic.before")} →{" "}
                        {pair[1].heading || t("editorTools.infographic.after")}
                      </span>
                    </span>
                    {expanded ? <ChevronDown size={15} className="text-[#777781]" /> : <ChevronRight size={15} className="text-[#777781]" />}
                  </button>
                  <div className="flex items-center gap-1">
                    <MoveButtons
                      index={rowIndex}
                      length={pairs.length}
                      label={t("editorTools.infographic.itemComparison")}
                      onMove={(direction) => movePair(rowIndex, direction)}
                    />
                    <MiniButton
                      label={t("editorTools.infographic.deleteComparison")}
                      disabled={pairs.length <= 1}
                      onClick={() => deletePair(rowIndex)}
                    >
                      <Trash2 size={14} />
                    </MiniButton>
                  </div>
                </div>

                {expanded ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {pair.map((item, sideIndex) => {
                      const itemIndex = rowIndex * 2 + sideIndex;
                      const icon = normalizeInfographicIcon(item.icon) ?? defaultInfographicIcon(itemIndex);
                      const sideLabel = sideIndex === 0
                        ? data.before_label ?? t("editorTools.infographic.before")
                        : data.after_label ?? t("editorTools.infographic.after");
                      return (
                        <div key={`${rowIndex}-${sideIndex}`} className="rounded-xl border border-[#ECECF1] bg-[#FAFAFC] p-3">
                          <div className="mb-3 text-[11px] font-semibold text-[#555560]">{sideLabel}</div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                            <div>
                              <button
                                type="button"
                                aria-label={t("editorTools.infographic.changeSideRowIconAria", {
                                  label: sideLabel,
                                  n: rowIndex + 1,
                                })}
                                className="flex w-full flex-col items-center gap-2 rounded-xl border border-[#DFE0E6] bg-white px-2 py-3 outline-none transition hover:border-[#BDAAF8] focus-visible:ring-2 focus-visible:ring-[#D8CEFA]"
                                onClick={() => setEditingIconIndex(itemIndex)}
                              >
                                <span className="grid size-11 place-items-center rounded-xl bg-[#506FBE]">
                                  <InfographicIconPreview color={icon.color} url={icon.url} />
                                </span>
                                <span className="text-[9px] font-semibold text-[#7C51F8]">
                                  {t("editorTools.infographic.changeIcon")}
                                </span>
                              </button>
                              <div className="mt-2">
                                <DeferredColorInput
                                  aria-label={t("editorTools.infographic.sideRowIconColorAria", {
                                    label: sideLabel,
                                    n: rowIndex + 1,
                                  })}
                                  className="h-8 w-full rounded-lg border border-[#E6E6EA] bg-white p-1"
                                  value={icon.color}
                                  onCommit={(color) => updatePairItem(rowIndex, sideIndex as 0 | 1, { icon: { ...icon, color } })}
                                />
                              </div>
                            </div>
                            <div>
                              <LabeledField label={t("editorTools.infographic.headingLabel")}>
                                <TextInput
                                  ariaLabel={t("editorTools.infographic.sideRowHeadingAria", {
                                    label: sideLabel,
                                    n: rowIndex + 1,
                                  })}
                                  value={item.heading ?? ""}
                                  onChange={(heading) => updatePairItem(rowIndex, sideIndex as 0 | 1, { heading })}
                                />
                              </LabeledField>
                              <LabeledField className="mt-2" label={t("editorTools.infographic.descriptionLabel")}>
                                <textarea
                                  aria-label={t("editorTools.infographic.sideRowDescriptionAria", {
                                    label: sideLabel,
                                    n: rowIndex + 1,
                                  })}
                                  className="min-h-[72px] w-full resize-y rounded-lg border border-[#E6E6EA] bg-white px-3 py-2 text-[12px] leading-5 text-[#191919] outline-none focus:border-[#7C51F8]"
                                  maxLength={280}
                                  value={item.description ?? ""}
                                  onChange={(event) => updatePairItem(rowIndex, sideIndex as 0 | 1, { description: event.target.value })}
                                />
                              </LabeledField>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </EditorSection>

      {editingIconIndex != null && editingItem ? (
        <IconsEditor
          currentIconUrl={normalizeInfographicIcon(editingItem.icon)?.url ?? defaultInfographicIcon(editingIconIndex).url}
          icon_prompt={[
            editingItem.heading?.trim() ||
              t("editorTools.infographic.comparisonItemN", {
                n: editingIconIndex + 1,
              })]}
          onClose={() => setEditingIconIndex(null)}
          onIconChange={(url) => {
            onChange({
              ...data,
              items: data.items.map((item, index) =>
                index === editingIconIndex
                  ? { ...item, icon: { url, color: normalizeInfographicIcon(item.icon)?.color ?? defaultInfographicIcon(index).color } }
                  : item,
              ),
            });
          }}
        />
      ) : null}
    </div>
  );
}

function MindMapEditor({
  data,
  onChange,
}: {
  data: MindMapInfographicData;
  onChange: (data: MindMapInfographicData) => void;
}) {
  const t = useT();
  const nested = data.items.length === 1 ? data.items[0]?.items ?? [] : [];
  const items = nested.length > 0 ? nested : data.items;
  return (
    <ItemCollectionEditor
      description={t("editorTools.infographic.nodesDescription")}
      itemLabel="node"
      items={items}
      onChange={(nextItems) =>
        onChange({
          ...data,
          items: nextItems.map((item) => ({ ...item, items: item.items ?? [] })),
        })
      }
      onCreate={() => ({
        icon: defaultInfographicIcon(items.length),
        heading: t("editorTools.infographic.newNode", { n: items.length + 1 }),
        description: t("editorTools.infographic.defaultItemDescription"),
        items: [],
      })}
    />
  );
}

function PillarFrameworkEditor({ data, onChange }: {
  data: PillarFrameworkInfographicData;
  onChange: (data: PillarFrameworkInfographicData) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      <EditorSection
        title={t("editorTools.infographic.frameworkTitleLabel")}
        description={t("editorTools.infographic.frameworkTitleDescription")}
      >
        <TextInput ariaLabel={t("editorTools.infographic.frameworkTitleAria")} value={data.title} onChange={(title) => onChange({ ...data, title })} />
      </EditorSection>
      <ItemCollectionEditor
        description={t("editorTools.infographic.pillarDescription")}
        itemLabel="pillar"
        items={data.items}
        minItems={3}
        maxItems={7}
        showFocus
        onChange={(items) => onChange({ ...data, items })}
        onCreate={() => ({
          icon: defaultInfographicIcon(data.items.length),
          heading: t("editorTools.infographic.newPillar", { n: data.items.length + 1 }),
          description: t("editorTools.infographic.defaultItemDescription"),
          focus: t("editorTools.infographic.pillarFocusContent"),
        })}
      />
    </div>
  );
}

function TransformationHubEditor({ data, onChange }: {
  data: TransformationHubInfographicData;
  onChange: (data: TransformationHubInfographicData) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      <EditorSection
        title={t("editorTools.infographic.centerLabelTitle")}
        description={t("editorTools.infographic.hubCenterLabelDescription")}
      >
        <TextInput ariaLabel={t("editorTools.infographic.hubCenterLabelAria")} value={data.center_label} onChange={(center_label) => onChange({ ...data, center_label })} />
      </EditorSection>
      <ItemCollectionEditor
        description={t("editorTools.infographic.hubDescription")}
        itemLabel="capability"
        items={data.items}
        minItems={2}
        maxItems={8}
        showIcons={false}
        showDescription={false}
        onChange={(items) => onChange({ ...data, items })}
        onCreate={() => ({
          heading: t("editorTools.infographic.newCapability", {
            n: data.items.length + 1,
          }),
        })}
      />
    </div>
  );
}

function RiskMatrixEditor({ data, onChange }: {
  data: RiskMatrixInfographicData;
  onChange: (data: RiskMatrixInfographicData) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      <EditorSection
        title={t("editorTools.infographic.centerLabelTitle")}
        description={t("editorTools.infographic.riskCenterLabelDescription")}
      >
        <TextInput ariaLabel={t("editorTools.infographic.riskCenterLabelAria")} value={data.center_label} onChange={(center_label) => onChange({ ...data, center_label: center_label.slice(0, 4) })} />
      </EditorSection>
      <ItemCollectionEditor
        description={t("editorTools.infographic.riskDescription")}
        itemLabel="activity"
        items={data.items}
        minItems={4}
        maxItems={4}
        onChange={(items) => onChange({ ...data, items })}
        onCreate={() => ({
          icon: defaultInfographicIcon(data.items.length),
          heading: t("editorTools.infographic.activityContent"),
          description: t("editorTools.infographic.defaultItemDescription"),
        })}
      />
    </div>
  );
}

function ImpactEffortEditor({
  data,
  onChange,
}: {
  data: ImpactEffortMatrixInfographicData;
  onChange: (data: ImpactEffortMatrixInfographicData) => void;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      <EditorSection
        title={t("editorTools.infographic.axisLabelsTitle")}
        description={t("editorTools.infographic.axisLabelsDescription")}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([
            ["editorTools.infographic.impactAxisLabel", "x_axis_label"],
            ["editorTools.infographic.effortAxisLabel", "y_axis_label"],
            ["editorTools.infographic.lowLabel", "low_label"],
            ["editorTools.infographic.highLabel", "high_label"],
          ] as const).map(([labelKey, key]) => (
            <LabeledField key={key} label={t(labelKey)}>
              <TextInput
                ariaLabel={t(labelKey)}
                value={data[key] ?? ""}
                onChange={(value) => onChange({ ...data, [key]: value })}
              />
            </LabeledField>
          ))}
        </div>
      </EditorSection>
      <ItemCollectionEditor
        description={t("editorTools.infographic.quadrantDescription")}
        itemLabel="quadrant"
        items={data.items}
        minItems={4}
        maxItems={4}
        showIcons={false}
        onChange={(items) => onChange({ ...data, items })}
        onCreate={() => ({
          heading: t("editorTools.infographic.quadrantContent"),
          description: t("editorTools.infographic.defaultItemDescription"),
        })}
      />
    </div>
  );
}

function ComparisonMatrixEditor({
  data,
  onChange,
}: {
  data: ComparisonMatrixInfographicData;
  onChange: (data: ComparisonMatrixInfographicData) => void;
}) {
  const t = useT();
  const [editingIconIndex, setEditingIconIndex] = useState<number | null>(null);
  const updateCriteria = (criteria: string[]) =>
    onChange({
      ...data,
      criteria,
      items: data.items.map((item) => ({
        ...item,
        values: criteria.map((_, index) => item.values[index] ?? ""),
      })),
    });
  const updateItem = (
    index: number,
    patch: Partial<ComparisonMatrixInfographicData["items"][number]>,
  ) => onChange({
    ...data,
    items: data.items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    ),
  });
  const editingItem = editingIconIndex == null ? null : data.items[editingIconIndex];
  return (
    <div className="space-y-4">
      <EditorSection
        title={t("editorTools.infographic.criteriaTitle")}
        description={t("editorTools.infographic.criteriaDescription")}
        action={
          <AddButton
            compact
            disabled={data.criteria.length >= 8}
            label={t("editorTools.infographic.addCriterion")}
            onClick={() =>
              updateCriteria([
                ...data.criteria,
                t("editorTools.infographic.newCriterion", {
                  n: data.criteria.length + 1,
                }),
              ])
            }
          />
        }
      >
        <div className="space-y-2">
          {data.criteria.map((criterion, index) => (
            <div key={`criterion-${index}`} className="flex gap-2">
              <TextInput
                ariaLabel={t("editorTools.infographic.criterionN", {
                  n: index + 1,
                })}
                value={criterion}
                onChange={(value) => updateCriteria(data.criteria.map((current, itemIndex) => itemIndex === index ? value : current))}
              />
              <MiniButton label={t("editorTools.infographic.deleteCriterion")} disabled={data.criteria.length <= 1} onClick={() => updateCriteria(data.criteria.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={14} /></MiniButton>
            </div>
          ))}
        </div>
      </EditorSection>
      <EditorSection
        title={t("editorTools.infographic.optionsTitle")}
        description={t("editorTools.infographic.optionsDescription")}
        action={
          <AddButton
            compact
            disabled={data.items.length >= 6}
            label={t("editorTools.infographic.addOption")}
            onClick={() =>
              onChange({
                ...data,
                items: [
                  ...data.items,
                  {
                    icon: defaultInfographicIcon(data.items.length),
                    heading: t("editorTools.infographic.newOption", {
                      n: data.items.length + 1,
                    }),
                    values: data.criteria.map(() => ""),
                  },
                ],
              })
            }
          />
        }
      >
        <div className="space-y-3">
          {data.items.map((item, index) => {
            const icon = normalizeInfographicIcon(item.icon) ?? defaultInfographicIcon(index);
            return (
              <div key={`comparison-option-${index}`} className="rounded-xl border border-[#ECECF1] bg-white p-4">
                <div className="mb-4 flex flex-wrap items-end gap-3 border-b border-[#EFEFF3] pb-4">
                  <button
                    type="button"
                    aria-label={t("editorTools.infographic.changeOptionIconAria", { n: index + 1 })}
                    className="grid size-11 place-items-center rounded-lg bg-[#506FBE] outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-[#D8CEFA]"
                    onClick={() => setEditingIconIndex(index)}
                  >
                    <InfographicIconPreview color={icon.color} url={icon.url} />
                  </button>
                  <div className="min-w-[180px] flex-1">
                    <LabeledField label={t("editorTools.infographic.headingLabel")}>
                      <TextInput
                        ariaLabel={t("editorTools.infographic.optionHeadingAria", { n: index + 1 })}
                        value={item.heading}
                        onChange={(heading) => updateItem(index, { heading })}
                      />
                    </LabeledField>
                  </div>
                  <DeferredColorInput
                    aria-label={t("editorTools.infographic.optionIconColorAria", { n: index + 1 })}
                    className="h-9 w-14 rounded-lg border border-[#E6E6EA] bg-white p-1"
                    value={icon.color}
                    onCommit={(color) => updateItem(index, { icon: { ...icon, color } })}
                  />
                  <MiniButton label={t("editorTools.infographic.deleteOption")} disabled={data.items.length <= 1} onClick={() => onChange({ ...data, items: data.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={14} /></MiniButton>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {data.criteria.map((criterion, valueIndex) => (
                    <LabeledField
                      key={`${index}-${valueIndex}`}
                      label={
                        criterion ||
                        t("editorTools.infographic.criterionN", {
                          n: valueIndex + 1,
                        })
                      }
                    >
                      <TextInput
                        ariaLabel={t("editorTools.infographic.valueFieldAria", {
                          heading: item.heading,
                          criterion,
                        })}
                        value={item.values[valueIndex] ?? ""}
                        onChange={(value) => updateItem(index, { values: data.criteria.map((_, criterionIndex) => criterionIndex === valueIndex ? value : item.values[criterionIndex] ?? "") })}
                      />
                    </LabeledField>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </EditorSection>
      {editingIconIndex != null && editingItem ? (
        <IconsEditor
          currentIconUrl={normalizeInfographicIcon(editingItem.icon)?.url ?? defaultInfographicIcon(editingIconIndex).url}
          icon_prompt={[editingItem.heading || t("editorTools.infographic.newOption", { n: editingIconIndex + 1 })]}
          onClose={() => setEditingIconIndex(null)}
          onIconChange={(url) => updateItem(editingIconIndex, { icon: { url, color: normalizeInfographicIcon(editingItem.icon)?.color ?? defaultInfographicIcon(editingIconIndex).color } })}
        />
      ) : null}
    </div>
  );
}

function HierarchyEditor({
  data,
  onChange,
}: {
  data: OrgChartInfographicData | DecisionTreeInfographicData;
  onChange: (data: OrgChartInfographicData | DecisionTreeInfographicData) => void;
}) {
  const t = useT();
  const updateItem = (index: number, patch: Partial<(typeof data.items)[number]>) =>
    onChange({ ...data, items: data.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  const addItem = () => {
    const id = `node-${Date.now().toString(36)}-${data.items.length + 1}`;
    onChange({ ...data, items: [...data.items, { id, parent_id: data.items[0]?.id ?? null, heading: t("editorTools.infographic.newItemContent"), description: data.type === "org_chart" ? t("editorTools.infographic.roleLabel") : null }] });
  };
  const deleteItem = (index: number) => {
    const removed = data.items[index];
    if (!removed || data.items.length <= 1) return;
    onChange({ ...data, items: data.items.filter((_, itemIndex) => itemIndex !== index).map((item) => item.parent_id === removed.id ? { ...item, parent_id: removed.parent_id ?? null } : item) });
  };
  return (
    <EditorSection
      title={
        data.type === "org_chart"
          ? t("editorTools.infographic.orgChartTitle")
          : t("editorTools.infographic.decisionNodesTitle")
      }
      description={t("editorTools.infographic.hierarchyDescription")}
      action={<AddButton compact disabled={data.items.length >= 16} label={t("editorTools.infographic.addItem")} onClick={addItem} />}
    >
      <div className="space-y-3">
        {data.items.map((item, index) => (
          <div key={item.id} className="rounded-xl border border-[#ECECF1] bg-white p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]">
              <LabeledField label={data.type === "org_chart" ? t("editorTools.infographic.nameLabel") : t("editorTools.infographic.labelLabel")}>
                <TextInput
                  ariaLabel={t("editorTools.infographic.itemHeadingAria", {
                    label: t("editorTools.infographic.item"),
                    n: index + 1,
                  })}
                  value={item.heading}
                  onChange={(heading) => updateItem(index, { heading })}
                />
              </LabeledField>
              <LabeledField label={t("editorTools.infographic.parentLabel")}>
                <select className={inputClassName} value={item.parent_id ?? ""} onChange={(event) => updateItem(index, { parent_id: event.target.value || null })}>
                  <option value="">{t("editorTools.infographic.topLevel")}</option>
                  {data.items.map((candidate) => candidate.id !== item.id ? <option key={candidate.id} value={candidate.id}>{candidate.heading || candidate.id}</option> : null)}
                </select>
              </LabeledField>
              <div className="flex justify-end sm:pt-7"><MiniButton label={t("editorTools.infographic.deleteItem")} disabled={data.items.length <= 1} onClick={() => deleteItem(index)}><Trash2 size={14} /></MiniButton></div>
            </div>
            {data.type === "org_chart" ? (
              <LabeledField className="mt-3" label={t("editorTools.infographic.roleLabel")}>
                <TextInput
                  ariaLabel={t("editorTools.infographic.itemRoleAria", {
                    n: index + 1,
                  })}
                  value={item.description ?? ""}
                  onChange={(description) => updateItem(index, { description })}
                />
              </LabeledField>
            ) : null}
          </div>
        ))}
      </div>
    </EditorSection>
  );
}

function ItemCollectionEditor<T extends TimelineInfographicItem>({
  description,
  itemLabel,
  items,
  maxItems,
  minItems = 1,
  onChange,
  onCreate,
  showIcons = true,
  showDescription = true,
  showFocus = false,
  showValue = false,
}: {
  description: string;
  itemLabel: string;
  items: T[];
  maxItems?: number;
  minItems?: number;
  onChange: (items: T[]) => void;
  onCreate: () => T;
  showIcons?: boolean;
  showDescription?: boolean;
  showFocus?: boolean;
  showValue?: boolean;
}) {
  const t = useT();
  const label = t(ITEM_LABEL_KEYS[itemLabel] ?? itemLabel);
  const [editingIconIndex, setEditingIconIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(() =>
    items.length > 0 ? 0 : null,
  );
  const itemRefs = useRef(new Map<number, HTMLDivElement>());
  const pendingScrollIndexRef = useRef<number | null>(null);
  const editingItem =
    editingIconIndex == null ? null : items[editingIconIndex] ?? null;

  useEffect(() => {
    const index = pendingScrollIndexRef.current;
    if (index == null || index >= items.length) return;
    pendingScrollIndexRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      itemRefs.current.get(index)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [items.length]);

  const addItem = () => {
    const nextIndex = items.length;
    pendingScrollIndexRef.current = nextIndex;
    setExpandedIndex(nextIndex);
    onChange([...items, onCreate()]);
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    setExpandedIndex((current) => {
      if (current === index) return targetIndex;
      if (current === targetIndex) return index;
      return current;
    });
    setEditingIconIndex((current) => {
      if (current === index) return targetIndex;
      if (current === targetIndex) return index;
      return current;
    });
    onChange(moveCollectionItem(items, index, direction));
  };

  const deleteItem = (index: number) => {
    setExpandedIndex((current) => {
      if (current == null) return null;
      if (current === index) {
        return items.length > 1 ? Math.min(index, items.length - 2) : null;
      }
      return current > index ? current - 1 : current;
    });
    setEditingIconIndex((current) => {
      if (current == null || current === index) return null;
      return current > index ? current - 1 : current;
    });
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <>
      <EditorSection
        title={t("editorTools.infographic.itemsTitle", {
          label: capitalize(label),
        })}
        description={description}
        action={
          <AddButton
            compact
            disabled={maxItems != null && items.length >= maxItems}
            label={t("editorTools.infographic.addLabel", { label })}
            onClick={addItem}
          />
        }
      >
        <div className="space-y-3">
          {items.map((item, index) => {
            const icon = normalizeInfographicIcon(item.icon) ?? defaultInfographicIcon(index);
            const isExpanded = expandedIndex === index;
            const accordionPanelId = `${itemLabel}-${index}-editor`;
            return (
              <div
                key={`${itemLabel}-${index}`}
                ref={(node) => {
                  if (node) itemRefs.current.set(index, node);
                  else itemRefs.current.delete(index);
                }}
                className={`overflow-hidden rounded-xl border bg-white transition ${isExpanded ? "border-[#CDBCFB]" : "border-[#ECECF1] hover:border-[#DADAE0]"}`}
              >
                <div
                  className={`flex min-h-[56px] items-center justify-between gap-3 px-3 ${isExpanded ? "border-b border-[#ECECF1] bg-[#FAF9FF]" : ""}`}
                >
                  <button
                    type="button"
                    aria-controls={accordionPanelId}
                    aria-expanded={isExpanded}
                    aria-label={t(
                      isExpanded
                        ? "editorTools.infographic.collapseLabelAria"
                        : "editorTools.infographic.expandLabelAria",
                      { label, n: index + 1 },
                    )}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#D8CEFA]"
                    onClick={() =>
                      setExpandedIndex((current) =>
                        current === index ? null : index,
                      )
                    }
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#F1ECFF] text-[10px] font-semibold text-[#7C51F8]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-medium text-[#191919]">
                        {t("editorTools.infographic.itemTitle", {
                          label: capitalize(label),
                          n: index + 1,
                        })}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-[#8B8B94]">
                        {item.heading?.trim() || t("common.untitled")}
                      </span>
                    </span>
                    {isExpanded ? (
                      <ChevronDown
                        size={15}
                        className="shrink-0 text-[#777781]"
                      />
                    ) : (
                      <ChevronRight
                        size={15}
                        className="shrink-0 text-[#777781]"
                      />
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <MoveButtons
                      index={index}
                      length={items.length}
                      label={label}
                      onMove={(direction) => moveItem(index, direction)}
                    />
                    <MiniButton
                      label={t("editorTools.infographic.deleteLabel", { label })}
                      disabled={items.length <= minItems}
                      onClick={() => deleteItem(index)}
                    >
                      <Trash2 size={14} />
                    </MiniButton>
                  </div>
                </div>

                {isExpanded ? (
                  <div
                    id={accordionPanelId}
                    className={`grid gap-4 p-4 ${
                      showIcons ? "grid-cols-1 sm:grid-cols-[116px_minmax(0,1fr)]" : "grid-cols-1"
                    }`}
                  >
                    {showIcons ? (
                      <div>
                        <span className="mb-1.5 block text-[11px] font-medium text-[#686873]">
                          {t("editorTools.infographic.iconLabel")}
                        </span>
                        <button
                          type="button"
                          aria-label={t("editorTools.infographic.changeItemIconAria", {
                            label,
                            n: index + 1,
                          })}
                          className="group flex w-full flex-col items-center gap-2 rounded-lg border border-[#E6E6EA] bg-[#F8F8FA] px-2 py-3 text-[#686873] outline-none transition hover:border-[#B8A3F8] focus-visible:ring-2 focus-visible:ring-[#D8CEFA]"
                          onClick={() => setEditingIconIndex(index)}
                        >
                          <span className="grid size-11 place-items-center rounded-lg bg-[#506FBE]">
                            <InfographicIconPreview
                              color={icon.color}
                              url={icon.url}
                            />
                          </span>
                          <span className="text-[10px] font-medium text-[#7C51F8]">
                            {t("editorTools.infographic.changeIcon")}
                          </span>
                        </button>
                        <div className="mt-3">
                          <LabeledField label={t("editorTools.infographic.iconColorLabel")}>
                            <DeferredColorInput
                              aria-label={t("editorTools.infographic.itemIconColorAria", {
                                label: capitalize(label),
                                n: index + 1,
                              })}
                              className="h-8 w-full rounded-lg border border-[#E6E6EA] bg-white p-1"
                              value={icon.color}
                              onCommit={(color) =>
                                onChange(
                                  items.map((current, itemIndex) =>
                                    itemIndex === index
                                      ? ({
                                          ...current,
                                          icon: {
                                            ...(normalizeInfographicIcon(current.icon) ?? icon),
                                            color,
                                          },
                                        } as T)
                                      : current,
                                  ),
                                )
                              }
                            />
                          </LabeledField>
                        </div>
                      </div>
                    ) : null}

                    <div className="min-w-0">
                      {showValue ? (
                        <NumberInput
                          label={t("editorTools.infographic.percentageLabel")}
                          max={100}
                          min={0}
                          value={
                            typeof (item as unknown as ConversionFunnelInfographicItem).value === "number"
                              ? (item as unknown as ConversionFunnelInfographicItem).value
                              : 0
                          }
                          onChange={(value) =>
                            onChange(
                              items.map((current, itemIndex) =>
                                itemIndex === index
                                  ? ({ ...current, value } as T)
                                  : current,
                              ),
                            )
                          }
                        />
                      ) : null}
                      <LabeledField
                        className={showValue ? "mt-3" : ""}
                        label={t("editorTools.infographic.headingLabel")}
                      >
                        <TextInput
                          ariaLabel={t("editorTools.infographic.itemHeadingAria", {
                            label: capitalize(label),
                            n: index + 1,
                          })}
                          value={item.heading ?? ""}
                          onChange={(heading) =>
                            onChange(
                              items.map((current, itemIndex) =>
                                itemIndex === index
                                  ? ({ ...current, heading } as T)
                                  : current,
                              ),
                            )
                          }
                        />
                      </LabeledField>
                      {showDescription ? (
                        <LabeledField
                          className="mt-3"
                          label={t("editorTools.infographic.descriptionLabel")}
                        >
                          <textarea
                            aria-label={t("editorTools.infographic.itemDescriptionAria", {
                              label: capitalize(label),
                              n: index + 1,
                            })}
                            className="min-h-[82px] w-full resize-y rounded-lg border border-[#E6E6EA] bg-white px-3 py-2 text-[12px] leading-5 text-[#191919] outline-none transition focus:border-[#7C51F8]"
                            maxLength={280}
                            value={item.description ?? ""}
                            onChange={(event) =>
                              onChange(
                                items.map((current, itemIndex) =>
                                  itemIndex === index
                                    ? ({
                                        ...current,
                                        description: event.target.value,
                                      } as T)
                                    : current,
                                ),
                              )
                            }
                          />
                        </LabeledField>
                      ) : null}
                      {showFocus ? (
                        <LabeledField
                          className="mt-3"
                          label={t("editorTools.infographic.focusLabel")}
                        >
                          <TextInput
                            ariaLabel={t("editorTools.infographic.itemFocusAria", {
                              label: capitalize(label),
                              n: index + 1,
                            })}
                            value={item.focus ?? ""}
                            onChange={(focus) =>
                              onChange(
                                items.map((current, itemIndex) =>
                                  itemIndex === index
                                    ? ({ ...current, focus } as T)
                                    : current,
                                ),
                              )
                            }
                          />
                        </LabeledField>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </EditorSection>

      {showIcons && editingIconIndex != null && editingItem ? (
        <IconsEditor
          currentIconUrl={
            normalizeInfographicIcon(editingItem.icon)?.url ?? defaultInfographicIcon(editingIconIndex).url
          }
          icon_prompt={[
            editingItem.heading?.trim() ||
              t("editorTools.infographic.itemTitle", {
                label: capitalize(label),
                n: editingIconIndex + 1,
              }),
          ]}
          onClose={() => setEditingIconIndex(null)}
          onIconChange={(url) => {
            onChange(
              items.map((current, itemIndex) =>
                itemIndex === editingIconIndex
                  ? ({
                      ...current,
                      icon: {
                        url,
                        color:
                          normalizeInfographicIcon(current.icon)?.color ??
                          defaultInfographicIcon(editingIconIndex).color,
                      },
                    } as T)
                  : current,
              ),
            );
          }}
        />
      ) : null}
    </>
  );
}

function InfographicIconPreview({
  color,
  url,
}: {
  color: string;
  url: string;
}) {
  const baseUrl =
    typeof window === "undefined" ? "http://localhost" : window.location.href;
  const previewUrl = buildSvgUpdateUrl(url, baseUrl, {
    color: color.startsWith("#") ? color : `#${color}`,
  });

  return previewUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="size-7 object-contain"
      draggable={false}
      src={previewUrl}
    />
  ) : (
    <ImageIcon className="size-6 text-white" />
  );
}

function EditorSection({
  action,
  children,
  description,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-[#ECECF1] bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[13px] font-medium text-[#191919]">{title}</h3>
          <p className="mt-1 text-[11px] leading-4 text-[#8B8B94]">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function LabeledField({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12px] font-medium text-[#686873]">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "h-9 w-full rounded-lg border border-[#E6E6EA] bg-white px-3 text-[12px] text-[#191919] outline-none transition focus:border-[#7C51F8]";

function TextInput({
  ariaLabel,
  className = "",
  value,
  onChange,
}: {
  ariaLabel: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className={`${inputClassName} ${className}`}
      maxLength={120}
      spellCheck={false}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function NumberInput({
  compact = false,
  label,
  max,
  min,
  step = 1,
  value,
  onChange,
}: {
  compact?: boolean;
  label: string;
  max?: number;
  min?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
}) {
  const input = (
    <input
      aria-label={label}
      className={inputClassName}
      max={max}
      min={min}
      step={step}
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (!Number.isFinite(next)) return;
        onChange(
          Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, next)),
        );
      }}
    />
  );
  return compact ? input : <LabeledField label={label}>{input}</LabeledField>;
}

function AddButton({
  compact = false,
  disabled = false,
  label,
  onClick,
}: {
  compact?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${compact ? "h-8 px-3" : "h-9 w-full px-3"} inline-flex items-center justify-center gap-1.5 rounded-full border border-[#E6E6EA] bg-white text-[12px] font-semibold text-[#191919] transition hover:bg-[#F7F7FA] disabled:cursor-not-allowed disabled:opacity-45`}
      disabled={disabled}
      onClick={onClick}
    >
      <Plus size={13} />
      {label}
    </button>
  );
}

function MiniButton({
  children,
  disabled = false,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#191919] outline-none transition hover:bg-[#F5F5F7] focus-visible:ring-2 focus-visible:ring-[#D8CEFA] disabled:cursor-not-allowed disabled:opacity-25"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function MoveButtons({
  index,
  label,
  length,
  onMove,
}: {
  index: number;
  label: string;
  length: number;
  onMove: (direction: -1 | 1) => void;
}) {
  const t = useT();
  return (
    <>
      <MiniButton
        label={t("editorTools.infographic.moveUp", { label })}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ChevronUp size={14} />
      </MiniButton>
      <MiniButton
        label={t("editorTools.infographic.moveDown", { label })}
        disabled={index === length - 1}
        onClick={() => onMove(1)}
      >
        <ChevronDown size={14} />
      </MiniButton>
    </>
  );
}

function defaultGanttItem(columnCount: number): GanttInfographicItem {
  return normalizeGanttItem(
    {
      name: "New task",
      start: { column: 0, offset: 0 },
      end: { column: 0, offset: 1 },
    },
    columnCount,
  );
}

function readMeterData(
  value: unknown,
  type: "progress_bar" | "gauge",
): MeterInfographicData {
  const data = readRecord(value);
  return {
    type,
    min_value: readNumber(data.min_value, 0),
    max_value: readNumber(data.max_value, 100),
    value: readNumber(data.value, 50),
  };
}

function readGanttData(value: unknown): GanttInfographicData {
  const data = readRecord(value);
  const columns = readArray(data.columns).map((column, index) => ({
    label: readString(readRecord(column).label, `Column ${index + 1}`),
  }));
  const safeColumns = columns.length > 0 ? columns : [{ label: "Column 1" }];
  const rows = readArray(data.rows).map((row, rowIndex) => {
    const record = readRecord(row);
    return {
      label: readString(record.label, `Row ${rowIndex + 1}`),
      items: readArray(record.items).map((item) => {
        const task = readRecord(item);
        return normalizeGanttItem(
          {
            name: readString(task.name, "Task"),
            start: readGanttPosition(task.start),
            end: readGanttPosition(task.end, { column: 0, offset: 1 }),
          },
          safeColumns.length,
        );
      }),
    };
  });
  return {
    type: "gantt",
    columns: safeColumns,
    rows:
      rows.length > 0
        ? rows
        : [{ label: "Row 1", items: [defaultGanttItem(safeColumns.length)] }],
  };
}

function readItemCollectionData(
  value: unknown,
  type: ItemCollectionInfographicData["type"],
): ItemCollectionInfographicData {
  const data = readRecord(value);
  const items = readArray(data.items).map(readTimelineItem);
  return {
    type,
    items:
      items.length > 0
        ? items
        : type === "pyramid"
          ? [
              { icon: defaultInfographicIcon(0), heading: "Foundation", description: "" },
              { icon: defaultInfographicIcon(1), heading: "Efficiency", description: "" },
              { icon: defaultInfographicIcon(2), heading: "Innovation", description: "" },
            ]
          : [{ icon: defaultInfographicIcon(), heading: "Step 1", description: "" }],
  };
}

function readRadialCycleData(value: unknown): RadialCycleInfographicData {
  const data = readRecord(value);
  const items = readArray(data.items).map(readTimelineItem);
  return {
    type: "radial_cycle",
    center_image: readNullableString(data.center_image),
    items:
      items.length > 0
        ? items
        : [{ heading: "Stage 1", description: "" }],
  };
}

function readBeforeAfterData(value: unknown): BeforeAfterInfographicData {
  const data = readRecord(value);
  const items = readArray(data.items).map(readTimelineItem);
  const safeItems = items.length >= 2
    ? items.slice(0, items.length - (items.length % 2))
    : [
        { icon: defaultInfographicIcon(0), heading: "Before", description: "" },
        { icon: defaultInfographicIcon(1), heading: "After", description: "" },
      ];
  return {
    type: "before_after",
    before_label: readString(data.before_label, "Before"),
    after_label: readString(data.after_label, "After"),
    items: safeItems,
  };
}

function readImpactEffortData(value: unknown): ImpactEffortMatrixInfographicData {
  const data = readRecord(value);
  const defaults: TimelineInfographicItem[] = [
    { heading: "Quick Wins", description: "High-impact initiatives requiring relatively low effort." },
    { heading: "Strategic Priorities", description: "High-impact initiatives requiring significant investment." },
    { heading: "Deprioritize", description: "Low-impact initiatives requiring substantial effort." },
    { heading: "Fill-ins", description: "Low-impact initiatives that are easy to implement." },
  ];
  const items = readArray(data.items).map(readTimelineItem);
  return {
    type: "impact_effort_matrix",
    x_axis_label: readString(data.x_axis_label, "Impact"),
    y_axis_label: readString(data.y_axis_label, "Effort"),
    low_label: readString(data.low_label, "Low"),
    high_label: readString(data.high_label, "High"),
    items: defaults.map((fallback, index) => items[index] ?? fallback),
  };
}

function readComparisonMatrixData(value: unknown): ComparisonMatrixInfographicData {
  const data = readRecord(value);
  const criteria = readArray(data.criteria).map((item, index) => readString(item, `Criterion ${index + 1}`));
  const safeCriteria = criteria.length > 0 ? criteria : ["Market Access", "Investment Required", "Speed to Market"];
  const items = readArray(data.items).map((value, index) => {
    const item = readRecord(value);
    const values = readArray(item.values).map((entry) => readString(entry, ""));
    return {
      icon: normalizeInfographicIcon(item.icon, item.color) ?? defaultInfographicIcon(index),
      heading: readString(item.heading, `Option ${index + 1}`),
      values: safeCriteria.map((_, valueIndex) => values[valueIndex] ?? ""),
    };
  });
  return {
    type: "comparison_matrix",
    criteria: safeCriteria,
    items: items.length > 0 ? items : [{ icon: defaultInfographicIcon(), heading: "Option 1", values: safeCriteria.map(() => "") }],
  };
}

function readHierarchyData(
  value: unknown,
  type: "org_chart" | "decision_tree",
): OrgChartInfographicData | DecisionTreeInfographicData {
  const data = readRecord(value);
  const items = readArray(data.items).map((value, index) => {
    const item = readRecord(value);
    return {
      id: readString(item.id, `node-${index + 1}`),
      parent_id: readNullableString(item.parent_id),
      heading: readString(item.heading, `Item ${index + 1}`),
      description: readNullableString(item.description),
    };
  });
  return {
    type,
    items: items.length > 0 ? items : [{ id: "node-1", parent_id: null, heading: type === "org_chart" ? "Leader" : "Decision", description: type === "org_chart" ? "Role" : null }],
  };
}

function readConversionFunnelData(
  value: unknown,
): ConversionFunnelInfographicData {
  const data = readRecord(value);
  const items = readArray(data.items).map((value, index) => {
    const item = readRecord(value);
    return {
      value: Math.min(100, Math.max(0, readNumber(item.value, 60 - index * 10))),
      heading: readString(item.heading, `Stage ${index + 1}`),
      description: readNullableString(item.description),
    };
  });
  return {
    type: "conversion_funnel",
    items:
      items.length > 0
        ? items
        : [{ value: 50, heading: "Stage 1", description: "" }],
  };
}

function readVerticalFunnelData(value: unknown): VerticalFunnelInfographicData {
  return { ...readConversionFunnelData(value), type: "vertical_funnel" };
}

function readMindMapData(value: unknown): MindMapInfographicData {
  const data = readRecord(value);
  const items = readArray(data.items).map(readMindMapNode);
  return {
    type: "mind_map",
    items:
      items.length > 0
        ? items
        : [
            {
              icon: defaultInfographicIcon(),
              heading: "Node 1",
              description: "",
              items: [],
            },
          ],
  };
}

function readTimelineItem(value: unknown): TimelineInfographicItem {
  const item = readRecord(value);
  return {
    icon: normalizeInfographicIcon(item.icon, item.color),
    heading: readNullableString(item.heading),
    description: readNullableString(item.description),
    label: readNullableString(item.label),
    focus: readNullableString(item.focus),
  };
}

function readPillarFrameworkData(value: unknown): PillarFrameworkInfographicData {
  const data = readRecord(value);
  const items = readArray(data.items).map(readTimelineItem);
  return {
    type: "pillar_framework",
    title: readString(data.title, "Growth & Transformation Framework"),
    items: items.length > 0 ? items : [{ icon: defaultInfographicIcon(), heading: "Customer", description: "", focus: "Experience & Value" }],
  };
}

function readTransformationHubData(value: unknown): TransformationHubInfographicData {
  const data = readRecord(value);
  const items = readArray(data.items).map(readTimelineItem);
  return { type: "transformation_hub", center_label: readString(data.center_label, "Business Transformation"), items: items.length > 0 ? items : [{ heading: "Strategy" }, { heading: "Process" }] };
}

function readRiskMatrixData(value: unknown): RiskMatrixInfographicData {
  const data = readRecord(value);
  const defaults = ["Identify", "Prioritize", "Assess", "Respond"].map((heading, index) => ({ icon: defaultInfographicIcon(index), heading, description: "Add a description." }));
  const items = readArray(data.items).map(readTimelineItem);
  return { type: "risk_matrix", center_label: readString(data.center_label, "RISK"), items: defaults.map((fallback, index) => items[index] ?? fallback) };
}

function readMindMapNode(value: unknown): MindMapInfographicNode {
  const item = readRecord(value);
  return {
    ...readTimelineItem(item),
    items: readArray(item.items).map(readMindMapNode),
  };
}

function readGanttPosition(
  value: unknown,
  fallback: GanttInfographicPosition = { column: 0, offset: 0 },
): GanttInfographicPosition {
  const position = readRecord(value);
  return {
    column: Math.max(0, Math.floor(readNumber(position.column, fallback.column))),
    offset: Math.min(
      1,
      Math.max(0, readNumber(position.offset, fallback.offset ?? 0)),
    ),
  };
}

function readInfographicType(value: unknown): InfographicType {
  return value === "progress_bar" ||
    value === "gauge" ||
    value === "gantt" ||
    value === "timeline" ||
    value === "roadmap" ||
    value === "milestone_timeline" ||
    value === "staircase" ||
    value === "supply_chain" ||
    value === "stair_step_blocks" ||
    value === "maturity_model" ||
    value === "diagonal_circles" ||
    value === "pillar_framework" ||
    value === "transformation_hub" ||
    value === "risk_matrix" ||
    value === "chevron_process" ||
    value === "radial_cycle" ||
    value === "conversion_funnel" ||
    value === "vertical_funnel" ||
    value === "pyramid" ||
    value === "segmented_wheel" ||
    value === "customer_journey" ||
    value === "before_after" ||
    value === "impact_effort_matrix" ||
    value === "comparison_matrix" ||
    value === "org_chart" ||
    value === "decision_tree" ||
    value === "mind_map"
    ? value
    : "gauge";
}

function infographicEditorItemCount(
  value: unknown,
  type: InfographicType,
): number {
  if (type === "progress_bar" || type === "gauge") return 0;
  const items = readArray(readRecord(value).items);
  if (type !== "mind_map" || items.length !== 1) return items.length;
  const nestedItems = readArray(readRecord(items[0]).items);
  return nestedItems.length > 0 ? nestedItems.length : items.length;
}

function readRecord(value: unknown): RawRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readColor(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : fallback;
}

function defaultInfographicTextColor(background: string): string {
  const hex = background.replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "111111";
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 150
    ? "F3F4F6"
    : "111111";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
