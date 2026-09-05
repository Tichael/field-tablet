import type { FormFieldType } from "../../../types/form";
import { Button } from "../../ui/button";
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
  X,
} from "lucide-react";

interface FieldPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: FormFieldType) => void;
  sectionTitle?: string;
}

interface PaletteItem {
  type: FormFieldType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "inputs" | "datetime" | "choices" | "advanced" | "layout";
}

const PALETTE_ITEMS: PaletteItem[] = [
  // Inputs
  {
    type: "text",
    label: "Single-Line Text",
    description: "Names, short titles, serial numbers, locations",
    icon: Type,
    category: "inputs",
  },
  {
    type: "textarea",
    label: "Multi-Line Text",
    description: "Detailed descriptions, work summaries, remarks",
    icon: FileText,
    category: "inputs",
  },
  {
    type: "number",
    label: "Numeric Input",
    description: "Quantities, measurements, meter readings, hours",
    icon: Hash,
    category: "inputs",
  },

  // Date & Time
  {
    type: "date",
    label: "Date",
    description: "Calendar date picker (can default to 'today')",
    icon: Calendar,
    category: "datetime",
  },
  {
    type: "time",
    label: "Time",
    description: "Time of day picker (hours & minutes)",
    icon: Clock,
    category: "datetime",
  },
  {
    type: "datetime",
    label: "Date & Time",
    description: "Combined timestamp picker (can default to 'now')",
    icon: CalendarClock,
    category: "datetime",
  },

  // Choices
  {
    type: "select",
    label: "Dropdown Select",
    description: "Single choice picked from a dropdown list",
    icon: List,
    category: "choices",
  },
  {
    type: "radio",
    label: "Radio Choice Cards",
    description: "Single choice displayed as distinct visual buttons",
    icon: CircleDot,
    category: "choices",
  },
  {
    type: "checkbox",
    label: "Yes / No Checkbox",
    description: "Single confirmation checkbox or boolean toggle",
    icon: CheckSquare,
    category: "choices",
  },
  {
    type: "checkbox-group",
    label: "Multi-Checklist",
    description: "Multiple selectable checkboxes from a list",
    icon: ListChecks,
    category: "choices",
  },

  // Advanced & Structure
  {
    type: "signature",
    label: "Digital Signature",
    description: "Stylus or finger signature canvas box",
    icon: PenTool,
    category: "advanced",
  },
  {
    type: "heading",
    label: "Section Subheading",
    description: "Visual divider to group related fields in a section",
    icon: Heading,
    category: "layout",
  },
  {
    type: "notes",
    label: "Instructional Note",
    description: "Callout text box with guidelines or safety notices",
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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="bg-background rounded-2xl shadow-2xl border w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/20 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-foreground">
              Add Form Field
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sectionTitle
                ? `Adding field to "${sectionTitle}"`
                : "Select a field type to insert into your form"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
            title="Close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Inputs Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Text & Number Inputs
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
                          {item.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {item.description}
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
              Date & Time
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
                          {item.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {item.description}
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
              Choices & Checklists
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
                          {item.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          {/* Advanced & Layout */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Signatures & Layout
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
                        {item.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
