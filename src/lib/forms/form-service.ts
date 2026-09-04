import { syncManager } from "../sync/sync-manager";
import type { FormTemplate, FormSubmission } from "../../types/form";
import type { AppConfig } from "../../store/config-store";
import {
  generateFormSubmissionPdf,
  sanitizeFilenamePart,
} from "./pdf-generator";
import {
  ALL_STARTER_TEMPLATES,
  STARTER_DAILY_REPORT,
  STARTER_INCIDENT_LOG,
  STARTER_EQUIPMENT_CHECK,
} from "./starter-templates";

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
   * Get or initialize the template for a specific form type in its configured folder.
   * Ensures form.json is written to disk so it can always be discovered and updated.
   */
  async getOrCreateTemplate(
    formType: "dailyReports" | "incidentLogs" | "equipmentChecks",
    folderPath: string,
  ): Promise<FormTemplate> {
    const adapter = syncManager.getAdapter();
    const cleanFolder = folderPath.trim().replace(/^\/+|\/+$/g, "");
    const templateFilePath = `${cleanFolder}/form.json`;

    try {
      const content = await adapter.readFileText(templateFilePath);
      const template = JSON.parse(content) as FormTemplate;
      template.folderPath = cleanFolder;
      return template;
    } catch {
      // Template doesn't exist yet in this folder; seed it from the starter template
      const starter =
        formType === "dailyReports"
          ? STARTER_DAILY_REPORT
          : formType === "incidentLogs"
            ? STARTER_INCIDENT_LOG
            : STARTER_EQUIPMENT_CHECK;

      const template: FormTemplate = {
        ...starter,
        folderPath: cleanFolder,
      };

      try {
        await adapter.createDirectory(cleanFolder);
        await adapter.createDirectory(`${cleanFolder}/Filled Forms`);
        await adapter.saveFile(
          templateFilePath,
          JSON.stringify(template, null, 2),
        );
      } catch (e) {
        console.warn(`Could not persist template to ${templateFilePath}:`, e);
      }

      return template;
    }
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
   * Save or update a form submission and export an immutable, dated PDF snapshot.
   */
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
   * List all previous submissions for a form folder.
   */
  async listSubmissions(formFolderPath: string): Promise<FormSubmission[]> {
    const adapter = syncManager.getAdapter();
    const cleanFolderPath = formFolderPath.trim().replace(/^\/+|\/+$/g, "");
    const filledFormsDir = `${cleanFolderPath}/Filled Forms`;

    try {
      let files = await adapter.listLocalFiles(filledFormsDir);
      // If Filled Forms is empty or does not exist, check the folder itself
      if (files.length === 0) {
        try {
          files = await adapter.listLocalFiles(cleanFolderPath);
        } catch {
          // ignore
        }
      }

      const jsonFiles = files.filter(
        (f) =>
          !f.isDirectory && f.name.endsWith(".json") && f.name !== "form.json",
      );
      const pdfFiles = files.filter(
        (f) => !f.isDirectory && f.name.toLowerCase().endsWith(".pdf"),
      );

      const submissions: FormSubmission[] = [];
      for (const file of jsonFiles) {
        try {
          const text = await adapter.readFileText(file.path);
          const sub = JSON.parse(text) as FormSubmission;

          // If pdfExports is empty or missing, populate from discovered PDFs
          if (!sub.pdfExports || sub.pdfExports.length === 0) {
            const matching = pdfFiles.filter((p) => p.name.startsWith(sub.id));
            if (matching.length > 0) {
              sub.pdfExports = matching.map((p) => ({
                path: p.path,
                filename: p.name,
                exportedAt: sub.updatedAt || sub.createdAt,
              }));
            }
          }

          submissions.push(sub);
        } catch (e) {
          console.warn(`Failed to parse submission file ${file.path}:`, e);
        }
      }

      // Sort newest first
      submissions.sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      );
      return submissions;
    } catch {
      return [];
    }
  }

  /**
   * List all dated PDF exports in the Filled Forms folder.
   */
  async listPdfExports(
    formFolderPath: string,
  ): Promise<{ name: string; path: string }[]> {
    const adapter = syncManager.getAdapter();
    const cleanFolderPath = formFolderPath.trim().replace(/^\/+|\/+$/g, "");
    const filledFormsDir = `${cleanFolderPath}/Filled Forms`;

    try {
      let files = await adapter.listLocalFiles(filledFormsDir);
      if (files.length === 0) {
        try {
          files = await adapter.listLocalFiles(cleanFolderPath);
        } catch {
          // ignore
        }
      }

      return files
        .filter((f) => !f.isDirectory && f.name.toLowerCase().endsWith(".pdf"))
        .map((f) => ({ name: f.name, path: f.path }))
        .sort((a, b) => b.name.localeCompare(a.name));
    } catch {
      return [];
    }
  }

  /**
   * Seed starter templates into a designated folder (e.g. "Reports" or "Forms").
   */
  async seedStarterTemplates(targetFormFolder: string): Promise<void> {
    const adapter = syncManager.getAdapter();
    const cleanFolder = targetFormFolder.trim().replace(/^\/+|\/+$/g, "");
    if (!cleanFolder) return;

    for (const starter of ALL_STARTER_TEMPLATES) {
      const formFolder = `${cleanFolder}/${starter.title}`;
      const templatePath = `${formFolder}/form.json`;

      try {
        // Check if form.json already exists
        await adapter.readFileText(templatePath);
      } catch {
        // Doesn't exist yet, create it
        try {
          await adapter.createDirectory(formFolder);
          await adapter.createDirectory(`${formFolder}/Filled Forms`);
          const customTemplate: FormTemplate = {
            ...starter,
            folderPath: formFolder,
            category: cleanFolder,
          };
          await adapter.saveFile(
            templatePath,
            JSON.stringify(customTemplate, null, 2),
          );
        } catch (e) {
          console.error(`Failed to seed starter template ${starter.title}:`, e);
        }
      }
    }
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
