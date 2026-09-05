import type { FormFieldType } from "../../../types/form";
import { useTranslation } from "react-i18next";
import { AppDialog } from "../../ui/app-dialog";
import {
  Type,
  FileText,
  Hash,
  Calendar,
  Clock,
  CalendarClock,
  List,
  CircleDot,
  CheckSquare,
  ListChecks,
  PenTool,
  Heading,
  HelpCircle,
  Camera,
  Video,
} from "lucide-react";

interface FieldPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: FormFieldType) => void;
  sectionTitle?: string;
}

interface PaletteItem {
  type: FormFieldType;
  labelKey: string;
  descKey: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "inputs" | "datetime" | "choices" | "media" | "advanced" | "layout";
}

const PALETTE_ITEMS: PaletteItem[] = [
  // Inputs
  {
    type: "text",
    labelKey: "editor.palette.itemTextLabel",
    descKey: "editor.palette.itemTextDesc",
    icon: Type,
    category: "inputs",
  },
  {
    type: "textarea",
    labelKey: "editor.palette.itemTextareaLabel",
    descKey: "editor.palette.itemTextareaDesc",
    icon: FileText,
    category: "inputs",
  },
  {
    type: "number",
    labelKey: "editor.palette.itemNumberLabel",
    descKey: "editor.palette.itemNumberDesc",
    icon: Hash,
    category: "inputs",
  },

  // Date & Time
  {
    type: "date",
    labelKey: "editor.palette.itemDateLabel",
    descKey: "editor.palette.itemDateDesc",
    icon: Calendar,
    category: "datetime",
  },
  {
    type: "time",
    labelKey: "editor.palette.itemTimeLabel",
    descKey: "editor.palette.itemTimeDesc",
    icon: Clock,
    category: "datetime",
  },
  {
    type: "datetime",
    labelKey: "editor.palette.itemDatetimeLabel",
    descKey: "editor.palette.itemDatetimeDesc",
    icon: CalendarClock,
    category: "datetime",
  },

  // Choices
  {
    type: "select",
    labelKey: "editor.palette.itemSelectLabel",
    descKey: "editor.palette.itemSelectDesc",
    icon: List,
    category: "choices",
  },
  {
    type: "radio",
    labelKey: "editor.palette.itemRadioLabel",
    descKey: "editor.palette.itemRadioDesc",
    icon: CircleDot,
    category: "choices",
  },
  {
    type: "checkbox",
    labelKey: "editor.palette.itemCheckboxLabel",
    descKey: "editor.palette.itemCheckboxDesc",
    icon: CheckSquare,
    category: "choices",
  },
  {
    type: "checkbox-group",
    labelKey: "editor.palette.itemCheckboxGroupLabel",
    descKey: "editor.palette.itemCheckboxGroupDesc",
    icon: ListChecks,
    category: "choices",
  },

  // Media & Attachments
  {
    type: "photo",
    labelKey: "editor.palette.itemPhotoLabel",
    descKey: "editor.palette.itemPhotoDesc",
    icon: Camera,
    category: "media",
  },
  {
    type: "video",
    labelKey: "editor.palette.itemVideoLabel",
    descKey: "editor.palette.itemVideoDesc",
    icon: Video,
    category: "media",
  },

  // Advanced & Structure
  {
    type: "signature",
    labelKey: "editor.palette.itemSignatureLabel",
    descKey: "editor.palette.itemSignatureDesc",
    icon: PenTool,
    category: "advanced",
  },
  {
    type: "heading",
    labelKey: "editor.palette.itemHeadingLabel",
    descKey: "editor.palette.itemHeadingDesc",
    icon: Heading,
    category: "layout",
  },
  {
    type: "notes",
    labelKey: "editor.palette.itemNotesLabel",
    descKey: "editor.palette.itemNotesDesc",
    icon: HelpCircle,
    category: "layout",
  },
];

export function FieldPalette({
  isOpen,
  onClose,
  onSelectType,
  sectionTitle,
}: FieldPaletteProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <AppDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("editor.palette.title")}
      subtitle={
        sectionTitle
          ? t("editor.palette.subtitleWithSection", {
              section: sectionTitle,
            })
          : t("editor.palette.subtitleDefault")
      }
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Inputs Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            {t("editor.palette.categoryInputs")}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PALETTE_ITEMS.filter((i) => i.category === "inputs").map(
              (item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      onSelectType(item.type);
                      onClose();
                    }}
                    className="flex flex-col text-left p-3.5 rounded-xl border bg-card hover:bg-muted/40 hover:border-primary/50 transition-all group focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-xs sm:text-sm">
                        {t(item.labelKey)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {t(item.descKey)}
                    </p>
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* Date & Time Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            {t("editor.palette.categoryDatetime")}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PALETTE_ITEMS.filter((i) => i.category === "datetime").map(
              (item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      onSelectType(item.type);
                      onClose();
                    }}
                    className="flex flex-col text-left p-3.5 rounded-xl border bg-card hover:bg-muted/40 hover:border-primary/50 transition-all group focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-xs sm:text-sm">
                        {t(item.labelKey)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {t(item.descKey)}
                    </p>
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* Choices Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            {t("editor.palette.categoryChoices")}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PALETTE_ITEMS.filter((i) => i.category === "choices").map(
              (item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      onSelectType(item.type);
                      onClose();
                    }}
                    className="flex flex-col text-left p-3.5 rounded-xl border bg-card hover:bg-muted/40 hover:border-primary/50 transition-all group focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-xs sm:text-sm">
                        {t(item.labelKey)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {t(item.descKey)}
                    </p>
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* Media & Attachments Section */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            {t("editor.palette.categoryMedia")}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PALETTE_ITEMS.filter((i) => i.category === "media").map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => {
                    onSelectType(item.type);
                    onClose();
                  }}
                  className="flex flex-col text-left p-3.5 rounded-xl border bg-card hover:bg-muted/40 hover:border-primary/50 transition-all group focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-xs sm:text-sm">
                      {t(item.labelKey)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {t(item.descKey)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced & Layout */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            {t("editor.palette.categoryAdvanced")}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {PALETTE_ITEMS.filter(
              (i) => i.category === "advanced" || i.category === "layout",
            ).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => {
                    onSelectType(item.type);
                    onClose();
                  }}
                  className="flex flex-col text-left p-3.5 rounded-xl border bg-card hover:bg-muted/40 hover:border-primary/50 transition-all group focus:outline-none focus:ring-2 focus:ring-primary text-foreground cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-xs sm:text-sm">
                      {t(item.labelKey)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {t(item.descKey)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </AppDialog>
  );
}
