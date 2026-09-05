import { useState, useEffect, useMemo } from "react";
import type {
  FormTemplate,
  FormSection,
  FormField,
  FormFieldType,
} from "../../../types/form";
import { formService } from "../../../lib/forms/form-service";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { useTranslation } from "react-i18next";
import { FieldPalette } from "./FieldPalette";
import { FieldInspector } from "./FieldInspector";
import { TemplateSaveDialog } from "./TemplateSaveDialog";
import { FormRunner } from "../FormRunner";
import {
  ChevronLeft,
  Plus,
  Save,
  Eye,
  Edit3,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  Type,
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
  FileText,
  Sliders,
  Columns,
  Camera,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FormEditorProps {
  initialTemplate?: FormTemplate | null;
  onClose: () => void;
  onSaved: (savedTemplate: FormTemplate) => void;
}

export function FormEditor({
  initialTemplate,
  onClose,
  onSaved,
}: FormEditorProps) {
  const { t } = useTranslation();
  // Initialize template draft
  const [template, setTemplate] = useState<FormTemplate>(() => {
    if (initialTemplate) {
      return JSON.parse(JSON.stringify(initialTemplate));
    }
    return formService.createEmptyTemplate("New Field Form", "");
  });

  const [activeSectionId, setActiveSectionId] = useState<string>(
    template.sections[0]?.id || "",
  );

  // View modes: "builder" | "preview" | "split"
  const [viewMode, setViewMode] = useState<"builder" | "preview" | "split">(
    "builder",
  );

  // Palette & Inspector states
  const [paletteSectionId, setPaletteSectionId] = useState<string | null>(null);
  const [inspectingField, setInspectingField] = useState<FormField | null>(
    null,
  );
  const [inspectingSectionId, setInspectingSectionId] = useState<string | null>(
    null,
  );
  const [isSaveDialogOpen, setSaveDialogOpen] = useState(false);

  // Track if user made edits
  const [isDirty, setIsDirty] = useState(false);

  // Keep activeSectionId valid
  useEffect(() => {
    if (!template.sections.some((s) => s.id === activeSectionId)) {
      setActiveSectionId(template.sections[0]?.id || "");
    }
  }, [template.sections, activeSectionId]);

  // Warn on browser unload if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // On narrow screens where split mode is hidden, switch away from split to builder
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024 && viewMode === "split") {
        setViewMode("builder");
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewMode]);

  // Collect all field IDs across the form
  const allFieldIds = useMemo(() => {
    const ids: string[] = [];
    template.sections.forEach((sec) => {
      sec.fields.forEach((f) => ids.push(f.id));
    });
    return ids;
  }, [template]);

  // Section actions
  const handleAddSection = () => {
    const newIndex = template.sections.length + 1;
    const newSectionId = `section_${Date.now()}`;
    const newSection: FormSection = {
      id: newSectionId,
      title: `Section ${newIndex}`,
      description: "",
      fields: [
        {
          id: `field_${Date.now()}`,
          type: "text",
          label: "New Field",
          placeholder: "Enter value...",
        },
      ],
    };

    setTemplate((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setActiveSectionId(newSectionId);
    setIsDirty(true);
  };

  const handleUpdateSectionTitle = (sectionId: string, title: string) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, title } : s,
      ),
    }));
    setIsDirty(true);
  };

  const handleUpdateSectionDesc = (sectionId: string, description: string) => {
    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, description } : s,
      ),
    }));
    setIsDirty(true);
  };

  const handleMoveSection = (
    sectionIndex: number,
    direction: "up" | "down",
  ) => {
    setTemplate((prev) => {
      const nextSections = [...prev.sections];
      const targetIndex =
        direction === "up" ? sectionIndex - 1 : sectionIndex + 1;
      if (targetIndex < 0 || targetIndex >= nextSections.length) return prev;
      const temp = nextSections[sectionIndex];
      nextSections[sectionIndex] = nextSections[targetIndex];
      nextSections[targetIndex] = temp;
      return { ...prev, sections: nextSections };
    });
    setIsDirty(true);
  };

  const handleDeleteSection = (sectionId: string) => {
    if (template.sections.length <= 1) {
      alert(t("editor.formEditor.minOneSectionAlert"));
      return;
    }

    const section = template.sections.find((s) => s.id === sectionId);
    if (section && section.fields.length > 0) {
      const confirm = window.confirm(
        t("editor.formEditor.deleteSectionConfirm", {
          title: section.title,
          count: section.fields.length,
        }),
      );
      if (!confirm) return;
    }

    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }));
    setIsDirty(true);
  };

  // Field actions
  const handleSelectFieldType = (type: FormFieldType) => {
    if (!paletteSectionId) return;

    const timestamp = Date.now();
    let newField: FormField;

    switch (type) {
      case "text":
        newField = {
          id: `text_${timestamp}`,
          type: "text",
          label: "Text Question",
          placeholder: "Enter details...",
        };
        break;
      case "textarea":
        newField = {
          id: `notes_${timestamp}`,
          type: "textarea",
          label: "Work Summary / Remarks",
          placeholder: "Enter detailed remarks...",
        };
        break;
      case "number":
        newField = {
          id: `num_${timestamp}`,
          type: "number",
          label: "Measurement / Reading",
          placeholder: "0.0",
        };
        break;
      case "date":
        newField = {
          id: `date_${timestamp}`,
          type: "date",
          label: "Inspection Date",
          defaultValue: "today",
          required: true,
        };
        break;
      case "time":
        newField = {
          id: `time_${timestamp}`,
          type: "time",
          label: "Time of Inspection",
        };
        break;
      case "datetime":
        newField = {
          id: `datetime_${timestamp}`,
          type: "datetime",
          label: "Incident Timestamp",
          defaultValue: "now",
          required: true,
        };
        break;
      case "select":
        newField = {
          id: `select_${timestamp}`,
          type: "select",
          label: "Condition / Status",
          options: [
            { label: "Satisfactory / Pass", value: "pass" },
            { label: "Needs Attention", value: "attention" },
            { label: "Failed / Out of Service", value: "fail" },
          ],
        };
        break;
      case "radio":
        newField = {
          id: `choice_${timestamp}`,
          type: "radio",
          label: "Operational Mode",
          options: [
            { label: "Normal Operation", value: "normal" },
            { label: "Reduced / Maintenance", value: "maintenance" },
            { label: "Shutdown", value: "shutdown" },
          ],
        };
        break;
      case "checkbox":
        newField = {
          id: `check_${timestamp}`,
          type: "checkbox",
          label: "Safety inspection completed and verified",
          required: true,
        };
        break;
      case "checkbox-group":
        newField = {
          id: `checks_${timestamp}`,
          type: "checkbox-group",
          label: "Personal Protective Equipment (PPE) Checked",
          options: [
            { label: "Hard Hat", value: "hard_hat" },
            { label: "Safety Glasses", value: "glasses" },
            { label: "Steel Toe Boots", value: "boots" },
            { label: "High-Visibility Vest", value: "hi_vis" },
          ],
        };
        break;
      case "signature":
        newField = {
          id: `signature_${timestamp}`,
          type: "signature",
          label: "Inspector / Technician Signature",
          required: true,
        };
        break;
      case "photo":
        newField = {
          id: `photo_${timestamp}`,
          type: "photo",
          label: "Site / Inspection Photo",
          helperText: "Capture photo with camera or choose from gallery",
          allowMultiple: true,
        };
        break;
      case "video":
        newField = {
          id: `video_${timestamp}`,
          type: "video",
          label: "Video Recording",
          helperText: "Record video or attach video file",
          allowMultiple: false,
        };
        break;
      case "heading":
        newField = {
          id: `head_${timestamp}`,
          type: "heading",
          label: "Equipment Physical Checks",
        };
        break;
      case "notes":
        newField = {
          id: `note_${timestamp}`,
          type: "notes",
          label:
            "Ensure all machinery is fully de-energized and locked out prior to commencing physical inspection.",
        };
        break;
      default:
        newField = {
          id: `field_${timestamp}`,
          type,
          label: "New Field",
        };
    }

    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === paletteSectionId
          ? { ...s, fields: [...s.fields, newField] }
          : s,
      ),
    }));

    // Immediately open inspector to customize this newly added field
    setInspectingField(newField);
    setInspectingSectionId(paletteSectionId);
    setPaletteSectionId(null);
    setIsDirty(true);
  };

  const handleSaveInspectedField = (updatedField: FormField) => {
    if (!inspectingSectionId) return;

    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) => {
        if (sec.id !== inspectingSectionId) return sec;
        return {
          ...sec,
          fields: sec.fields.map((f) =>
            f.id === inspectingField?.id ? updatedField : f,
          ),
        };
      }),
    }));

    setInspectingField(null);
    setInspectingSectionId(null);
    setIsDirty(true);
  };

  const handleDuplicateField = (sectionId: string, fieldIndex: number) => {
    setTemplate((prev) => {
      const section = prev.sections.find((s) => s.id === sectionId);
      if (!section) return prev;

      const sourceField = section.fields[fieldIndex];
      const randomSuffix = Math.random().toString(36).slice(2, 6);
      const clonedField: FormField = {
        ...JSON.parse(JSON.stringify(sourceField)),
        id: `${sourceField.id}_copy_${randomSuffix}`,
        label: `${sourceField.label} (Copy)`,
        isIdentifier: false,
      };

      const updatedFields = [...section.fields];
      updatedFields.splice(fieldIndex + 1, 0, clonedField);

      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, fields: updatedFields } : s,
        ),
      };
    });
    setIsDirty(true);
  };

  const handleDeleteField = (sectionId: string, fieldId: string) => {
    const section = template.sections.find((s) => s.id === sectionId);
    if (section && section.fields.length <= 1) {
      const confirmed = window.confirm(
        t("editor.formEditor.deleteFieldEmptySectionConfirm", {
          title: section.title,
        }),
      );
      if (!confirmed) return;
    }

    setTemplate((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) }
          : s,
      ),
    }));
    setIsDirty(true);
  };

  const handleMoveField = (
    sectionId: string,
    fieldIndex: number,
    direction: "up" | "down",
  ) => {
    setTemplate((prev) => {
      const section = prev.sections.find((s) => s.id === sectionId);
      if (!section) return prev;

      const targetIndex = direction === "up" ? fieldIndex - 1 : fieldIndex + 1;
      if (targetIndex < 0 || targetIndex >= section.fields.length) return prev;

      const nextFields = [...section.fields];
      const temp = nextFields[fieldIndex];
      nextFields[fieldIndex] = nextFields[targetIndex];
      nextFields[targetIndex] = temp;

      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, fields: nextFields } : s,
        ),
      };
    });
    setIsDirty(true);
  };

  // Close with dirty check
  const handleClose = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        t("editor.formEditor.discardChangesConfirm"),
      );
      if (!confirmed) return;
    }
    onClose();
  };

  // Persist template
  const handleExecuteSave = async (
    finalTemplate: FormTemplate,
    targetFolder: string,
  ) => {
    const saved = await formService.saveTemplate(finalTemplate, targetFolder);
    setTemplate(saved);
    setIsDirty(false);
    onSaved(saved);
  };

  const getFieldTypeIcon = (type: FormFieldType) => {
    switch (type) {
      case "text":
        return <Type className="w-4 h-4 text-primary" />;
      case "textarea":
        return <FileText className="w-4 h-4 text-primary" />;
      case "number":
        return <Hash className="w-4 h-4 text-primary" />;
      case "date":
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case "time":
        return <Clock className="w-4 h-4 text-blue-500" />;
      case "datetime":
        return <CalendarClock className="w-4 h-4 text-blue-500" />;
      case "select":
        return <List className="w-4 h-4 text-amber-500" />;
      case "radio":
        return <CircleDot className="w-4 h-4 text-amber-500" />;
      case "checkbox":
        return <CheckSquare className="w-4 h-4 text-emerald-500" />;
      case "checkbox-group":
        return <ListChecks className="w-4 h-4 text-amber-500" />;
      case "signature":
        return <PenTool className="w-4 h-4 text-purple-500" />;
      case "photo":
        return <Camera className="w-4 h-4 text-emerald-500" />;
      case "video":
        return <Video className="w-4 h-4 text-blue-500" />;
      case "heading":
        return <Heading className="w-4 h-4 text-muted-foreground" />;
      case "notes":
        return <HelpCircle className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Type className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const activeSection = template.sections.find((s) => s.id === activeSectionId);
  const activeSectionIndex = template.sections.findIndex(
    (s) => s.id === activeSectionId,
  );

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* 1. Header Toolbar */}
      <header className="flex items-center justify-between p-3 sm:p-4 border-b bg-muted/20 shadow-xs shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="rounded-full shrink-0"
            title={t("common.back")}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base sm:text-lg truncate text-foreground">
                {template.title || t("editor.formEditor.untitledForm")}
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                v{template.version || 1}
              </span>
              {template.category && (
                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded font-semibold bg-secondary text-secondary-foreground border border-border/40">
                  {template.category}
                </span>
              )}
              {isDirty && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic">
                  {t("editor.formEditor.unsaved")}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {template.folderPath
                ? t("editor.formEditor.destinationPath", {
                    path: template.folderPath,
                  })
                : t("editor.formEditor.formEditorTitle")}
            </p>
          </div>
        </div>

        {/* Mode Switcher & Save Action */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-muted/50 p-1 rounded-xl border">
            <Button
              variant={viewMode === "builder" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setViewMode("builder")}
              className="text-xs gap-1.5 font-semibold"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {t("editor.formEditor.builder")}
              </span>
            </Button>
            <Button
              variant={viewMode === "preview" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setViewMode("preview")}
              className="text-xs gap-1.5 font-semibold"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{t("editor.formEditor.preview")}</span>
            </Button>
            <Button
              variant={viewMode === "split" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setViewMode("split")}
              className="hidden lg:flex text-xs gap-1.5 font-semibold"
              title={t("editor.formEditor.sideBySideTitle")}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>{t("editor.formEditor.split")}</span>
            </Button>
          </div>

          <Button
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
            className="gap-1.5 font-semibold shadow-xs"
          >
            <Save className="w-4 h-4" />
            <span>{t("editor.formEditor.saveTemplate")}</span>
          </Button>
        </div>
      </header>

      {/* 2. Main Work Area */}
      <div className="flex-1 overflow-hidden flex flex-row">
        {/* BUILDER PANE (Visible in "builder" or "split") */}
        {(viewMode === "builder" || viewMode === "split") && (
          <div
            className={cn(
              "flex flex-col overflow-hidden bg-muted/10 border-r",
              viewMode === "split" ? "w-1/2" : "w-full",
            )}
          >
            {/* Form Settings Sub-Bar */}
            <div className="p-3 border-b bg-background flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex-1 min-w-[200px]">
                <Input
                  value={template.title}
                  onChange={(e) => {
                    setTemplate((prev) => ({ ...prev, title: e.target.value }));
                    setIsDirty(true);
                  }}
                  placeholder={t("editor.formEditor.formTitlePlaceholder")}
                  className="font-bold text-sm h-8"
                  title={t("editor.saveDialog.formTitle")}
                />
              </div>

              <div className="w-40 sm:w-48">
                <Input
                  value={template.category || ""}
                  onChange={(e) => {
                    setTemplate((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }));
                    setIsDirty(true);
                  }}
                  placeholder={t("editor.formEditor.formCategoryPlaceholder")}
                  className="text-xs h-8"
                  title={t("editor.saveDialog.category")}
                />
              </div>

              <div className="flex-1 min-w-[220px]">
                <Input
                  value={template.description || ""}
                  onChange={(e) => {
                    setTemplate((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }));
                    setIsDirty(true);
                  }}
                  placeholder={t("editor.formEditor.formDescPlaceholder")}
                  className="text-xs h-8 text-muted-foreground"
                  title={t("editor.saveDialog.description")}
                />
              </div>
            </div>

            {/* Sections Tab Bar */}
            <div className="border-b bg-muted/30 p-2 flex items-center justify-between shrink-0 overflow-x-auto gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                {template.sections.map((sec) => {
                  const isActive = sec.id === activeSectionId;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setActiveSectionId(sec.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer",
                        isActive
                          ? "bg-background text-foreground shadow-xs border"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                      )}
                    >
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      <span className="truncate max-w-[140px]">
                        {sec.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ({sec.fields.length})
                      </span>
                    </button>
                  );
                })}
              </div>

              <Button
                size="xs"
                variant="outline"
                onClick={handleAddSection}
                className="gap-1 text-xs shrink-0 font-medium"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span>{t("editor.formEditor.addSection")}</span>
              </Button>
            </div>

            {/* Active Section Content */}
            {activeSection ? (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-4xl w-full mx-auto">
                {/* Section Header Controls */}
                <div className="bg-card border rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <Layers className="w-4 h-4 text-primary shrink-0" />
                      <Input
                        value={activeSection.title}
                        onChange={(e) =>
                          handleUpdateSectionTitle(
                            activeSection.id,
                            e.target.value,
                          )
                        }
                        placeholder={t(
                          "editor.formEditor.sectionTitleInputPlaceholder",
                        )}
                        className="font-bold text-sm h-8 flex-1"
                      />
                    </div>

                    {/* Section Move / Delete Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          handleMoveSection(activeSectionIndex, "up")
                        }
                        disabled={activeSectionIndex === 0}
                        title={t("editor.formEditor.moveSectionUp")}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() =>
                          handleMoveSection(activeSectionIndex, "down")
                        }
                        disabled={
                          activeSectionIndex === template.sections.length - 1
                        }
                        title={t("editor.formEditor.moveSectionDown")}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDeleteSection(activeSection.id)}
                        disabled={template.sections.length <= 1}
                        className="text-muted-foreground hover:text-destructive"
                        title={t("editor.formEditor.deleteSection")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <Input
                    value={activeSection.description || ""}
                    onChange={(e) =>
                      handleUpdateSectionDesc(activeSection.id, e.target.value)
                    }
                    placeholder={t(
                      "editor.formEditor.sectionDescInputPlaceholder",
                    )}
                    className="text-xs h-7 text-muted-foreground"
                  />
                </div>

                {/* Fields List */}
                <div className="space-y-3">
                  {activeSection.fields.length === 0 ? (
                    <div className="border border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-3 bg-card">
                      <FileText className="w-10 h-10 text-muted-foreground/30" />
                      <div className="space-y-0.5">
                        <h4 className="font-semibold text-sm">
                          {t("editor.formEditor.sectionNoFieldsTitle")}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {t("editor.formEditor.sectionNoFieldsDesc")}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setPaletteSectionId(activeSection.id)}
                        className="gap-1.5 mt-1"
                      >
                        <Plus className="w-4 h-4" />{" "}
                        {t("editor.formEditor.addField")}
                      </Button>
                    </div>
                  ) : (
                    activeSection.fields.map((field, fIdx) => (
                      <div
                        key={field.id}
                        className="bg-card border rounded-2xl p-4 shadow-xs space-y-3 hover:border-primary/40 transition-colors group"
                      >
                        {/* Field Header Row */}
                        <div className="flex items-center justify-between gap-2 pb-2 border-b">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1.5 rounded-lg bg-muted shrink-0">
                              {getFieldTypeIcon(field.type)}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground truncate">
                                  {field.label}
                                </span>
                                {field.required && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-destructive/10 text-destructive">
                                    {t("common.required")}
                                  </span>
                                )}
                                {field.isIdentifier && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                    {t("editor.formEditor.fileIdentifierBadge")}
                                  </span>
                                )}
                                {field.allowMultiple && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    {t("editor.formEditor.multiFileBadge")}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground block truncate">
                                id: {field.id}
                              </span>
                            </div>
                          </div>

                          {/* Field Action Buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                handleMoveField(activeSection.id, fIdx, "up")
                              }
                              disabled={fIdx === 0}
                              title={t("editor.formEditor.moveUp")}
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                handleMoveField(activeSection.id, fIdx, "down")
                              }
                              disabled={
                                fIdx === activeSection.fields.length - 1
                              }
                              title={t("editor.formEditor.moveDown")}
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => {
                                setInspectingField(field);
                                setInspectingSectionId(activeSection.id);
                              }}
                              className="text-primary hover:bg-primary/10"
                              title={t("editor.formEditor.configureFieldProps")}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                handleDuplicateField(activeSection.id, fIdx)
                              }
                              title={t("editor.formEditor.duplicateField")}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                handleDeleteField(activeSection.id, field.id)
                              }
                              className="text-muted-foreground hover:text-destructive"
                              title={t("editor.formEditor.deleteField")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Visual Mock Representation */}
                        <div className="pt-1">
                          {field.type === "text" && (
                            <div className="h-9 px-3 rounded-lg border bg-muted/20 text-xs text-muted-foreground flex items-center">
                              {field.placeholder || "Text input preview..."}
                            </div>
                          )}

                          {field.type === "textarea" && (
                            <div className="h-16 px-3 py-2 rounded-lg border bg-muted/20 text-xs text-muted-foreground">
                              {field.placeholder ||
                                "Multi-line text area preview..."}
                            </div>
                          )}

                          {field.type === "number" && (
                            <div className="h-9 px-3 rounded-lg border bg-muted/20 text-xs text-muted-foreground flex items-center font-mono">
                              {field.placeholder || "0.0"}
                            </div>
                          )}

                          {field.type === "date" && (
                            <div className="h-9 px-3 rounded-lg border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-blue-500" />
                              <span>
                                {field.defaultValue === "today"
                                  ? "Defaults to Today's Date (YYYY-MM-DD)"
                                  : "YYYY-MM-DD"}
                              </span>
                            </div>
                          )}

                          {field.type === "time" && (
                            <div className="h-9 px-3 rounded-lg border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-blue-500" />
                              <span>HH:MM (24h)</span>
                            </div>
                          )}

                          {field.type === "datetime" && (
                            <div className="h-9 px-3 rounded-lg border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                              <CalendarClock className="w-3.5 h-3.5 text-blue-500" />
                              <span>
                                {field.defaultValue === "now"
                                  ? "Defaults to Current Date & Time"
                                  : "YYYY-MM-DD HH:MM"}
                              </span>
                            </div>
                          )}

                          {field.type === "select" && (
                            <div className="h-9 px-3 rounded-lg border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
                              <span>
                                {field.options?.[0]?.label ||
                                  t("forms.runner.selectOption")}
                              </span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </div>
                          )}

                          {field.type === "radio" && (
                            <div className="grid grid-cols-2 gap-2">
                              {field.options?.map((opt, oIdx) => (
                                <div
                                  key={opt.value}
                                  className={cn(
                                    "p-2 rounded-lg border text-xs flex items-center gap-2",
                                    oIdx === 0
                                      ? "bg-primary/5 border-primary/30 font-medium"
                                      : "bg-muted/10",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "w-3.5 h-3.5 rounded-full border flex items-center justify-center",
                                      oIdx === 0
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-muted-foreground",
                                    )}
                                  >
                                    {oIdx === 0 && (
                                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                    )}
                                  </div>
                                  <span className="truncate">{opt.label}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {field.type === "checkbox" && (
                            <div className="p-3 rounded-xl border bg-muted/15 flex items-center gap-2.5 text-xs font-medium">
                              <div className="w-4 h-4 rounded border flex items-center justify-center border-primary bg-primary text-primary-foreground">
                                ✓
                              </div>
                              <span>{field.label}</span>
                            </div>
                          )}

                          {field.type === "checkbox-group" && (
                            <div className="grid grid-cols-2 gap-2">
                              {field.options?.map((opt) => (
                                <div
                                  key={opt.value}
                                  className="p-2 rounded-lg border bg-muted/10 text-xs flex items-center gap-2"
                                >
                                  <div className="w-3.5 h-3.5 rounded border border-muted-foreground" />
                                  <span className="truncate">{opt.label}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {field.type === "signature" && (
                            <div className="h-20 rounded-xl border border-dashed bg-muted/15 flex flex-col items-center justify-center text-xs text-muted-foreground gap-1">
                              <PenTool className="w-5 h-5 text-purple-500 opacity-60" />
                              <span>
                                {t("editor.palette.itemSignatureDesc")}
                              </span>
                            </div>
                          )}

                          {field.type === "heading" && (
                            <div className="border-b pb-1 font-bold text-sm text-foreground">
                              {field.label}
                            </div>
                          )}

                          {field.type === "notes" && (
                            <div className="p-3 rounded-xl border bg-blue-500/5 border-blue-500/20 text-xs text-muted-foreground flex items-start gap-2">
                              <HelpCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                              <span>{field.label}</span>
                            </div>
                          )}

                          {field.helperText && (
                            <p className="text-[11px] text-muted-foreground italic mt-1.5">
                              {field.helperText}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {/* Add Field Button */}
                  <Button
                    variant="outline"
                    className="w-full border-dashed py-5 gap-1.5 text-xs font-semibold hover:border-primary/50 hover:bg-primary/5"
                    onClick={() => setPaletteSectionId(activeSection.id)}
                  >
                    <Plus className="w-4 h-4 text-primary" />
                    <span>
                      {t("editor.formEditor.addFieldToSection", {
                        section: activeSection.title,
                      })}
                    </span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {t("editor.formEditor.noSectionSelected")}
              </div>
            )}
          </div>
        )}

        {/* LIVE PREVIEW PANE (Visible in "preview" or "split") */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div
            className={cn(
              "flex flex-col h-full bg-background overflow-hidden relative",
              viewMode === "split" ? "w-1/2" : "w-full",
            )}
          >
            {/* Preview Banner */}
            <div className="p-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between shrink-0 px-4">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="font-semibold">
                  {t("editor.formEditor.interactivePreview")}
                </span>
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  {t("editor.formEditor.interactivePreviewSubtitle")}
                </span>
              </div>
              {viewMode === "preview" && (
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => setViewMode("builder")}
                  className="text-xs"
                >
                  {t("editor.formEditor.backToBuilder")}
                </Button>
              )}
            </div>

            {/* Embedded FormRunner */}
            <div className="flex-1 overflow-hidden">
              <FormRunner
                template={template}
                isPreview={true}
                onClose={() => setViewMode("builder")}
                onViewPdf={() => {}}
              />
            </div>
          </div>
        )}
      </div>

      {/* Field Palette Modal */}
      <FieldPalette
        isOpen={Boolean(paletteSectionId)}
        onClose={() => setPaletteSectionId(null)}
        onSelectType={handleSelectFieldType}
        sectionTitle={
          template.sections.find((s) => s.id === paletteSectionId)?.title
        }
      />

      {/* Field Inspector Modal */}
      <FieldInspector
        field={inspectingField}
        isOpen={Boolean(inspectingField)}
        onClose={() => {
          setInspectingField(null);
          setInspectingSectionId(null);
        }}
        onSave={handleSaveInspectedField}
        existingFieldIds={allFieldIds}
      />

      {/* Save Template Dialog */}
      <TemplateSaveDialog
        isOpen={isSaveDialogOpen}
        template={template}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleExecuteSave}
      />
    </div>
  );
}
