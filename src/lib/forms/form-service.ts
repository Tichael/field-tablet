import { syncManager } from "../sync/sync-manager";
import type { FormTemplate, FormSubmission, FormAttachment } from "../../types/form";
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
        // Skip if marked as relocated via _MOVED_TO.txt
        const isMoved = await adapter
          .readFileText(`${cleanFolder}/_MOVED_TO.txt`)
          .then(() => true)
          .catch(() => false);
        if (isMoved) continue;

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
            const isSubMoved = await adapter
              .readFileText(`${item.path}/_MOVED_TO.txt`)
              .then(() => true)
              .catch(() => false);
            if (isSubMoved) continue;

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

    // Exclude any template whose folderPath is in another template's legacyFolderPaths
    const allLegacyPaths = new Set<string>();
    for (const t of discovered) {
      if (t.legacyFolderPaths) {
        t.legacyFolderPaths.forEach((p) => allLegacyPaths.add(p));
      }
    }
    const validDiscovered = discovered.filter(
      (t) => !allLegacyPaths.has(t.folderPath),
    );

    // Sort alphabetically by title
    validDiscovered.sort((a, b) => a.title.localeCompare(b.title));
    return validDiscovered;
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
      template.id &&
      template.id !== "new-field-form" &&
      template.id !== "new-form"
        ? template.id
        : sanitizeFilenamePart(cleanTitle).toLowerCase() || "custom-form";

    // Track folder move in legacyFolderPaths and leave a notice in old folder
    const previousFolder = template.folderPath
      ?.trim()
      .replace(/^\/+|\/+$/g, "");
    let legacyFolderPaths = template.legacyFolderPaths
      ? [...template.legacyFolderPaths]
      : [];
    if (previousFolder && previousFolder !== destinationFolder) {
      if (!legacyFolderPaths.includes(previousFolder)) {
        legacyFolderPaths.push(previousFolder);
      }
      // Attempt to write notice file in previous folder
      await this.writeMoveNotice(previousFolder, destinationFolder);
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
      // Only write notice if the old folder already exists and has/had a form.json
      const hasOldForm = await adapter
        .readFileText(`${cleanOld}/form.json`)
        .then(() => true)
        .catch(() => false);
      if (hasOldForm) {
        await adapter.createDirectory(cleanOld);
        const noticeText = `NOTICE:\nThis form template was relocated to:\n/${cleanNew}\n\nPlease check the new folder for current templates, submissions, and PDF copies.\n`;
        await adapter.saveFile(`${cleanOld}/_MOVED_TO.txt`, noticeText);
      }
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

    // Ensure template folder and Filled Forms directory exist
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

    // Determine instance directory: <FormFolder>/Filled Forms/<SubmissionId>
    const instanceFolder =
      submission.instanceFolderPath || `${filledFormsDir}/${submission.id}`;
    await adapter.createDirectory(instanceFolder);

    // Save and co-locate attachments inside instanceFolder
    const updatedValues = { ...submission.values };
    const allAttachments: FormAttachment[] = [];

    for (const section of template.sections) {
      for (const field of section.fields) {
        if (field.type === "photo" || field.type === "video") {
          const val = updatedValues[field.id];
          if (!val) continue;

          const rawList: FormAttachment[] = Array.isArray(val) ? val : [val];
          const processedList: FormAttachment[] = [];

          for (let i = 0; i < rawList.length; i++) {
            const att = { ...rawList[i] };
            const cleanLabel =
              sanitizeFilenamePart(field.label) ||
              (field.type === "photo" ? "Photo" : "Video");
            const ext =
              att.type === "video"
                ? att.name?.split(".").pop() || "mp4"
                : att.name?.split(".").pop() || "jpg";

            // Format human-readable filename e.g. Damage_Inspection_1.jpg, Engine_Sound_1.mp4
            const targetFilename =
              att.filename || `${cleanLabel}_${i + 1}.${ext}`;
            const targetPath = `${instanceFolder}/${targetFilename}`;

            // If attachment has new dataUrl (pending upload), write binary to disk
            if (att.dataUrl) {
              const commaIdx = att.dataUrl.indexOf(",");
              const base64 =
                commaIdx >= 0 ? att.dataUrl.slice(commaIdx + 1) : att.dataUrl;
              await adapter.saveFile(targetPath, base64, { isBase64: true });
            }

            // Clean attachment record without large in-memory dataUrl for storage
            const savedAtt: FormAttachment = {
              ...att,
              filename: targetFilename,
              path: targetPath,
              dataUrl: undefined,
            };

            processedList.push(savedAtt);
            allAttachments.push(savedAtt);
          }

          updatedValues[field.id] = Array.isArray(val)
            ? processedList
            : processedList[0];
        }
      }
    }

    // Generate dated PDF snapshot (with photos embedded using in-memory dataUrls where available)
    const pdfResult = await generateFormSubmissionPdf({
      template,
      submission: {
        ...submission,
        instanceFolderPath: instanceFolder,
        values: submission.values, // keeps in-memory dataUrl for PDF rendering
      },
      config,
      exportDate: now,
    });

    const pdfPath = `${instanceFolder}/${pdfResult.filename}`;

    // Write binary PDF to disk / remote inside instance folder
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
      instanceFolderPath: instanceFolder,
      updatedAt: isoNow,
      values: updatedValues,
      pdfExports: updatedPdfExports,
      attachments: allAttachments.length > 0 ? allAttachments : undefined,
    };

    // Save submission JSON into instance folder
    const subJsonPath = `${instanceFolder}/${submission.id}.json`;
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
        const entries = await adapter.listLocalFiles(filledFormsDir);

        for (const entry of entries) {
          if (entry.isDirectory) {
            try {
              const instanceFiles = await adapter.listLocalFiles(entry.path);
              const jsonFiles = instanceFiles.filter(
                (f) => !f.isDirectory && f.name.endsWith(".json"),
              );
              const pdfFiles = instanceFiles.filter(
                (f) => !f.isDirectory && f.name.toLowerCase().endsWith(".pdf"),
              );

              for (const file of jsonFiles) {
                try {
                  const text = await adapter.readFileText(file.path);
                  const sub = JSON.parse(text) as FormSubmission;
                  sub.instanceFolderPath = entry.path;

                  // Populate pdfExports from discovered PDFs if empty
                  if (!sub.pdfExports || sub.pdfExports.length === 0) {
                    sub.pdfExports = pdfFiles.map((p) => ({
                      path: p.path,
                      filename: p.name,
                      exportedAt: sub.updatedAt || sub.createdAt,
                    }));
                  }

                  if (!submissionMap.has(sub.id)) {
                    submissionMap.set(sub.id, sub);
                  }
                } catch (e) {
                  console.warn(`Failed to parse instance submission file ${file.path}:`, e);
                }
              }
            } catch (e) {
              console.warn(`Failed to read instance directory ${entry.path}:`, e);
            }
          } else if (
            !entry.isDirectory &&
            entry.name.endsWith(".json") &&
            entry.name !== "form.json"
          ) {
            try {
              const text = await adapter.readFileText(entry.path);
              const sub = JSON.parse(text) as FormSubmission;
              if (!submissionMap.has(sub.id)) {
                submissionMap.set(sub.id, sub);
              }
            } catch (e) {
              console.warn(`Failed to parse flat submission file ${entry.path}:`, e);
            }
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
        const entries = await adapter.listLocalFiles(filledFormsDir);
        for (const entry of entries) {
          if (entry.isDirectory) {
            try {
              const files = await adapter.listLocalFiles(entry.path);
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
          } else if (
            !entry.isDirectory &&
            entry.name.toLowerCase().endsWith(".pdf")
          ) {
            if (!pdfMap.has(entry.name)) {
              pdfMap.set(entry.name, { name: entry.name, path: entry.path });
            }
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
