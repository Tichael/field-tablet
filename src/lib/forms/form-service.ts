import { syncManager } from "../sync/sync-manager";
import type { FormTemplate, FormSubmission } from "../../types/form";
import type { AppConfig } from "../../store/config-store";
import {
  generateFormSubmissionPdf,
  sanitizeFilenamePart,
} from "./pdf-generator";

export class FormService {
  /**
   * Discovers all forms across configured form folders.
   * Checks both:
   * 1. Direct form folders (<folder>/form.json)
   * 2. Subdirectories in container folders (<folder>/<subfolder>/form.json)
   */
  async discoverForms(formFolders: string[]): Promise<FormTemplate[]> {
    const adapter = syncManager.getAdapter();
    const discovered: FormTemplate[] = [];
    const seenPaths = new Set<string>();

    for (const folder of formFolders) {
      const cleanFolder = folder.trim().replace(/^\/+|\/+$/g, "");
      if (!cleanFolder) continue;

      // 1. Check if cleanFolder itself contains form.json
      try {
        const directContent = await adapter.readFileText(
          `${cleanFolder}/form.json`,
        );
        const template = JSON.parse(directContent) as FormTemplate;
        template.folderPath = cleanFolder;
        if (!seenPaths.has(cleanFolder)) {
          seenPaths.add(cleanFolder);
          discovered.push(template);
        }
        continue;
      } catch {
        // Not a direct form folder, check subdirectories
      }

      // 2. Check subdirectories inside cleanFolder
      try {
        const subItems = await adapter.listLocalFiles(cleanFolder);
        for (const item of subItems) {
          if (item.isDirectory && item.name !== "Filled Forms") {
            const templatePath = `${item.path}/form.json`;
            try {
              const content = await adapter.readFileText(templatePath);
              const template = JSON.parse(content) as FormTemplate;
              template.folderPath = item.path;
              if (!seenPaths.has(item.path)) {
                seenPaths.add(item.path);
                discovered.push(template);
              }
            } catch {
              // Not a form directory or form.json doesn't exist yet, ignore
            }
          }
        }
      } catch (e) {
        console.warn(`Could not list folder /${cleanFolder}:`, e);
      }
    }

    // Sort alphabetically by title
    discovered.sort((a, b) => a.title.localeCompare(b.title));
    return discovered;
  }

  /**
   * Load a single form template from a folder path (e.g. "Reports/Daily Report").
   */
  async loadTemplate(folderPath: string): Promise<FormTemplate | null> {
    const adapter = syncManager.getAdapter();
    const cleanPath = folderPath.trim().replace(/^\/+|\/+$/g, "");
    const templateFilePath = `${cleanPath}/form.json`;

    try {
      const content = await adapter.readFileText(templateFilePath);
      const template = JSON.parse(content) as FormTemplate;
      template.folderPath = cleanPath;
      return template;
    } catch (e) {
      console.error(`Failed to load form template at ${templateFilePath}:`, e);
      return null;
    }
  }

  /**
   * Creates a blank new form template with sensible defaults.
   */
  createEmptyTemplate(
    title: string = "New Form",
    folderPath: string = "",
  ): FormTemplate {
    const now = new Date().toISOString();
    const cleanTitle = title.trim() || "New Form";
    const slug = sanitizeFilenamePart(cleanTitle).toLowerCase() || "new-form";

    return {
      id: slug,
      title: cleanTitle,
      description: "",
      version: 1,
      createdAt: now,
      updatedAt: now,
      folderPath: folderPath.trim().replace(/^\/+|\/+$/g, ""),
      category: "",
      sections: [
        {
          id: "section_1",
          title: "General Information",
          description: "",
          fields: [
            {
              id: "title",
              type: "text",
              label: "Title / Name",
              placeholder: "Enter title or name...",
              required: true,
              isIdentifier: true,
            },
            {
              id: "date",
              type: "date",
              label: "Date",
              required: true,
              defaultValue: "today",
            },
          ],
        },
      ],
    };
  }

  /**
   * Validates a form template schema.
   */
  validateTemplate(template: FormTemplate): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!template.title || !template.title.trim()) {
      errors.push("Form title is required.");
    }

    if (!template.sections || template.sections.length === 0) {
      errors.push("Form must contain at least one section.");
    } else {
      const fieldIdSet = new Set<string>();

      template.sections.forEach((section, sIndex) => {
        if (!section.title || !section.title.trim()) {
          errors.push(`Section ${sIndex + 1} must have a title.`);
        }

        if (!section.fields || section.fields.length === 0) {
          errors.push(
            `Section "${section.title || sIndex + 1}" must have at least one field.`,
          );
        } else {
          section.fields.forEach((field, fIndex) => {
            const fieldLocation = `Section "${section.title || sIndex + 1}", Field ${fIndex + 1}`;

            if (!field.label || !field.label.trim()) {
              errors.push(`${fieldLocation} must have a label.`);
            }

            if (!field.id || !field.id.trim()) {
              errors.push(`${fieldLocation} must have an ID.`);
            } else {
              if (fieldIdSet.has(field.id)) {
                errors.push(
                  `Duplicate field ID "${field.id}" found in ${fieldLocation}. Field IDs must be unique across the form.`,
                );
              }
              fieldIdSet.add(field.id);
            }

            if (
              field.type === "select" ||
              field.type === "radio" ||
              field.type === "checkbox-group"
            ) {
              if (!field.options || field.options.length === 0) {
                errors.push(
                  `Field "${field.label || field.id}" (${field.type}) must have at least one option.`,
                );
              } else {
                const optValues = new Set<string>();
                field.options.forEach((opt, oIndex) => {
                  if (!opt.label || !opt.label.trim()) {
                    errors.push(
                      `Field "${field.label || field.id}" option ${oIndex + 1} must have a label.`,
                    );
                  }
                  if (!opt.value || !opt.value.trim()) {
                    errors.push(
                      `Field "${field.label || field.id}" option ${oIndex + 1} must have a value.`,
                    );
                  } else {
                    if (optValues.has(opt.value)) {
                      errors.push(
                        `Duplicate option value "${opt.value}" in field "${field.label || field.id}". Option values must be unique.`,
                      );
                    }
                    optValues.add(opt.value);
                  }
                });
              }
            }

            if (
              field.type === "number" &&
              field.validation?.min !== undefined &&
              field.validation?.max !== undefined &&
              field.validation.min > field.validation.max
            ) {
              errors.push(
                `Field "${field.label || field.id}" min value (${field.validation.min}) cannot be greater than max value (${field.validation.max}).`,
              );
            }
          });
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Saves or updates a form template (form.json) into its designated folder.
   * Ensures the folder and its "Filled Forms" directory exist.
   * If updating an existing template, increments the version number.
   */
  async saveTemplate(
    template: FormTemplate,
    targetFolderPath?: string,
  ): Promise<FormTemplate> {
    const adapter = syncManager.getAdapter();
    const destinationFolder = (targetFolderPath || template.folderPath || "")
      .trim()
      .replace(/^\/+|\/+$/g, "");

    if (!destinationFolder) {
      throw new Error("Folder destination is required to save form template.");
    }

    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(
        `Template validation failed:\n${validation.errors.join("\n")}`,
      );
    }

    const templateFilePath = `${destinationFolder}/form.json`;
    const filledFormsDir = `${destinationFolder}/Filled Forms`;

    await adapter.createDirectory(destinationFolder);
    await adapter.createDirectory(filledFormsDir);

    const now = new Date().toISOString();
    let version = template.version || 1;
    let createdAt = template.createdAt || now;

    // Check if form.json already exists in this folder
    try {
      const existingContent = await adapter.readFileText(templateFilePath);
      const existing = JSON.parse(existingContent) as FormTemplate;
      if (existing) {
        createdAt = existing.createdAt || createdAt;
        // If updating existing, increment version
        version = Math.max((existing.version || 1) + 1, version + 1);
      }
    } catch {
      // New template in this folder, keep version as 1
      version = template.version || 1;
    }

    const cleanTitle = template.title.trim();
    const slug =
      template.id ||
      sanitizeFilenamePart(cleanTitle).toLowerCase() ||
      "custom-form";

    // Track folder move in legacyFolderPaths and leave a notice in old folder
    const previousFolder = template.folderPath
      ?.trim()
      .replace(/^\/+|\/+$/g, "");
    let legacyFolderPaths = template.legacyFolderPaths
      ? [...template.legacyFolderPaths]
      : [];
    if (
      previousFolder &&
      previousFolder !== destinationFolder &&
      !legacyFolderPaths.includes(previousFolder)
    ) {
      legacyFolderPaths.push(previousFolder);
      // Attempt to write notice file in previous folder
      this.writeMoveNotice(previousFolder, destinationFolder).catch(
        console.warn,
      );
    }

    const savedTemplate: FormTemplate = {
      ...template,
      id: slug,
      title: cleanTitle,
      version,
      createdAt,
      updatedAt: now,
      folderPath: destinationFolder,
      legacyFolderPaths:
        legacyFolderPaths.length > 0 ? legacyFolderPaths : undefined,
    };

    await adapter.saveFile(
      templateFilePath,
      JSON.stringify(savedTemplate, null, 2),
    );

    return savedTemplate;
  }

  /**
   * Drops a _MOVED_TO.txt notice into an old folder so desktop users browsing SMB share know where it moved.
   */
  async writeMoveNotice(
    oldFolderPath: string,
    newFolderPath: string,
  ): Promise<void> {
    const adapter = syncManager.getAdapter();
    const cleanOld = oldFolderPath.trim().replace(/^\/+|\/+$/g, "");
    const cleanNew = newFolderPath.trim().replace(/^\/+|\/+$/g, "");
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

    try {
      await adapter.createDirectory(cleanOld);
      const noticeText = `NOTICE:\nThis form template was relocated to:\n/${cleanNew}\n\nPlease check the new folder for current templates, submissions, and PDF copies.\n`;
      await adapter.saveFile(`${cleanOld}/_MOVED_TO.txt`, noticeText);
    } catch (e) {
      console.warn(`Could not write move notice in /${cleanOld}:`, e);
    }
  }

  /**
   * Duplicates an existing form template to a new title and folder.
   */
  async duplicateTemplate(
    source: FormTemplate,
    newTitle: string,
    newFolderPath: string,
  ): Promise<FormTemplate> {
    const cleanTitle = newTitle.trim();
    const cleanFolder = newFolderPath.trim().replace(/^\/+|\/+$/g, "");
    const slug =
      sanitizeFilenamePart(cleanTitle).toLowerCase() || "cloned-form";
    const now = new Date().toISOString();

    const clonedSections = JSON.parse(JSON.stringify(source.sections));

    const clonedTemplate: FormTemplate = {
      ...source,
      id: slug,
      title: cleanTitle,
      version: 1,
      createdAt: now,
      updatedAt: now,
      folderPath: cleanFolder,
      legacyFolderPaths: undefined,
      sections: clonedSections,
    };

    return this.saveTemplate(clonedTemplate, cleanFolder);
  }
  async saveSubmissionAndExportPdf(
    template: FormTemplate,
    submission: FormSubmission,
    config: AppConfig,
  ): Promise<{
    submission: FormSubmission;
    pdfPath: string;
    filename: string;
  }> {
    const adapter = syncManager.getAdapter();
    const cleanFolderPath = template.folderPath
      .trim()
      .replace(/^\/+|\/+$/g, "");
    const filledFormsDir = `${cleanFolderPath}/Filled Forms`;

    // Ensure the folder and Filled Forms directory exist
    await adapter.createDirectory(cleanFolderPath);
    await adapter.createDirectory(filledFormsDir);

    // Ensure form.json exists in this folder
    try {
      await adapter.readFileText(`${cleanFolderPath}/form.json`);
    } catch {
      await adapter.saveFile(
        `${cleanFolderPath}/form.json`,
        JSON.stringify(template, null, 2),
      );
    }

    const now = new Date();
    const isoNow = now.toISOString();

    // Generate dated PDF snapshot
    const pdfResult = await generateFormSubmissionPdf({
      template,
      submission,
      config,
      exportDate: now,
    });

    const pdfPath = `${filledFormsDir}/${pdfResult.filename}`;

    // Write binary PDF to disk / remote
    await adapter.saveFile(pdfPath, pdfResult.base64, { isBase64: true });

    // Update submission record with this new PDF export
    const updatedPdfExports = [
      ...(submission.pdfExports || []),
      {
        path: pdfPath,
        filename: pdfResult.filename,
        exportedAt: isoNow,
      },
    ];

    const updatedSubmission: FormSubmission = {
      ...submission,
      templateId: template.id,
      templateTitle: template.title,
      templateVersion: template.version || 1,
      folderPath: cleanFolderPath,
      updatedAt: isoNow,
      pdfExports: updatedPdfExports,
    };

    // Save submission JSON
    const subJsonPath = `${filledFormsDir}/${submission.id}.json`;
    await adapter.saveFile(
      subJsonPath,
      JSON.stringify(updatedSubmission, null, 2),
    );

    return {
      submission: updatedSubmission,
      pdfPath,
      filename: pdfResult.filename,
    };
  }

  /**
   * List all previous submissions for a form folder (and any legacy folders).
   */
  async listSubmissions(
    formFolderPath: string,
    legacyFolderPaths?: string[],
  ): Promise<FormSubmission[]> {
    const foldersToScan = [formFolderPath, ...(legacyFolderPaths || [])]
      .map((f) => f?.trim().replace(/^\/+|\/+$/g, ""))
      .filter((f): f is string => Boolean(f));

    const adapter = syncManager.getAdapter();
    const submissionMap = new Map<string, FormSubmission>();

    for (const folder of foldersToScan) {
      const filledFormsDir = `${folder}/Filled Forms`;
      try {
        let files = await adapter.listLocalFiles(filledFormsDir);
        // If Filled Forms is empty or does not exist, check the folder itself
        if (files.length === 0) {
          try {
            files = await adapter.listLocalFiles(folder);
          } catch {
            // ignore
          }
        }

        const jsonFiles = files.filter(
          (f) =>
            !f.isDirectory &&
            f.name.endsWith(".json") &&
            f.name !== "form.json",
        );
        const pdfFiles = files.filter(
          (f) => !f.isDirectory && f.name.toLowerCase().endsWith(".pdf"),
        );

        for (const file of jsonFiles) {
          try {
            const text = await adapter.readFileText(file.path);
            const sub = JSON.parse(text) as FormSubmission;

            // If pdfExports is empty or missing, populate from discovered PDFs
            if (!sub.pdfExports || sub.pdfExports.length === 0) {
              const matching = pdfFiles.filter((p) =>
                p.name.startsWith(sub.id),
              );
              if (matching.length > 0) {
                sub.pdfExports = matching.map((p) => ({
                  path: p.path,
                  filename: p.name,
                  exportedAt: sub.updatedAt || sub.createdAt,
                }));
              }
            }

            if (!submissionMap.has(sub.id)) {
              submissionMap.set(sub.id, sub);
            }
          } catch (e) {
            console.warn(`Failed to parse submission file ${file.path}:`, e);
          }
        }
      } catch {
        // ignore
      }
    }

    const submissions = Array.from(submissionMap.values());
    submissions.sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime(),
    );
    return submissions;
  }

  /**
   * List all dated PDF exports in the Filled Forms folder (and any legacy folders).
   */
  async listPdfExports(
    formFolderPath: string,
    legacyFolderPaths?: string[],
  ): Promise<{ name: string; path: string }[]> {
    const foldersToScan = [formFolderPath, ...(legacyFolderPaths || [])]
      .map((f) => f?.trim().replace(/^\/+|\/+$/g, ""))
      .filter((f): f is string => Boolean(f));

    const adapter = syncManager.getAdapter();
    const pdfMap = new Map<string, { name: string; path: string }>();

    for (const folder of foldersToScan) {
      const filledFormsDir = `${folder}/Filled Forms`;
      try {
        let files = await adapter.listLocalFiles(filledFormsDir);
        if (files.length === 0) {
          try {
            files = await adapter.listLocalFiles(folder);
          } catch {
            // ignore
          }
        }

        const pdfs = files
          .filter(
            (f) => !f.isDirectory && f.name.toLowerCase().endsWith(".pdf"),
          )
          .map((f) => ({ name: f.name, path: f.path }));

        for (const pdf of pdfs) {
          if (!pdfMap.has(pdf.name)) {
            pdfMap.set(pdf.name, pdf);
          }
        }
      } catch {
        // ignore
      }
    }

    return Array.from(pdfMap.values()).sort((a, b) =>
      b.name.localeCompare(a.name),
    );
  }

  /**
   * Generate a clean human-readable submission ID.
   * Example: Daily_Report_2026-09-03_073000
   * Or with identifier: Equipment_Check_Unit-402_2026-09-03_073000
   */
  generateSubmissionId(
    formTitle: string,
    identifierValue?: string,
    date: Date = new Date(),
  ): string {
    const cleanTitle = sanitizeFilenamePart(formTitle) || "Form";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const timestamp = `${year}-${month}-${day}_${hours}${minutes}${seconds}`;

    if (identifierValue && identifierValue.trim()) {
      const cleanId = sanitizeFilenamePart(identifierValue);
      if (cleanId) {
        return `${cleanTitle}_${cleanId}_${timestamp}`;
      }
    }

    return `${cleanTitle}_${timestamp}`;
  }
}

export const formService = new FormService();
