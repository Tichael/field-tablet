export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "time"
  | "datetime"
  | "select"
  | "radio"
  | "checkbox"
  | "checkbox-group"
  | "signature"
  | "heading"
  | "notes";

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  defaultValue?: any;
  options?: FormFieldOption[];
  isIdentifier?: boolean; // When true, value is used in file naming (e.g. Unit 402)
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormTemplate {
  id: string;
  title: string;
  description?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  folderPath: string; // e.g. "Reports/Daily Report"
  category?: string;
  sections: FormSection[];
}

export interface PdfExportRecord {
  path: string;
  filename: string;
  exportedAt: string;
}

export interface FormSubmission {
  id: string; // Human-friendly file slug, e.g. "Daily_Report_2026-09-03_0730"
  templateId: string;
  templateTitle: string;
  templateVersion: number;
  folderPath: string; // e.g. "Reports/Daily Report"
  createdAt: string;
  updatedAt: string;
  status: "draft" | "completed";
  values: Record<string, any>;
  pdfExports: PdfExportRecord[];
}
