import { describe, it, expect, beforeEach } from "vitest";
import { formService } from "./form-service";
import { syncManager } from "../sync/sync-manager";
import type { StorageAdapter, FileInfo } from "../storage/adapter";
import type { FormTemplate, FormSubmission } from "../../types/form";
import { getFormFoldersList, type AppConfig } from "../../store/config-store";

const TEST_REPORT_TEMPLATE: FormTemplate = {
  id: "test-daily-report",
  title: "Daily Report",
  description: "Shift progress and crew work activities.",
  version: 1,
  folderPath: "Reports/Daily Report",
  createdAt: "2026-09-03T00:00:00.000Z",
  updatedAt: "2026-09-03T00:00:00.000Z",
  sections: [
    {
      id: "sec-info",
      title: "Shift Information",
      fields: [
        {
          id: "work_date",
          label: "Work Date",
          type: "date",
          required: true,
        },
        {
          id: "shift",
          label: "Shift",
          type: "select",
          options: [
            { label: "Day Shift", value: "day" },
            { label: "Night Shift", value: "night" },
          ],
          required: true,
        },
        {
          id: "supervisor_name",
          label: "Supervisor / Foreperson",
          type: "text",
          required: true,
          isIdentifier: true,
        },
      ],
    },
    {
      id: "sec-activities",
      title: "Work Activities",
      fields: [
        {
          id: "work_completed",
          label: "Summary of Work Completed",
          type: "textarea",
          required: true,
        },
      ],
    },
  ],
};

// In-memory mock storage adapter for isolated unit testing
class MockStorageAdapter implements StorageAdapter {
  id = "mock-storage";
  private files = new Map<string, { content: string; isBase64?: boolean }>();
  private dirs = new Set<string>();

  isAvailable() {
    return true;
  }
  async requestPermission() {
    return true;
  }
  async verifyPermission() {
    return true;
  }

  async getFiles() {
    return Array.from(this.files.entries()).map(([name, { content }]) => ({
      name,
      content,
    }));
  }

  async saveFile(
    path: string,
    content: string,
    options?: { isBase64?: boolean },
  ) {
    const cleanPath = path.trim().replace(/^\/+|\/+$/g, "");
    this.files.set(cleanPath, { content, isBase64: options?.isBase64 });
    const parts = cleanPath.split("/");
    parts.pop();
    if (parts.length > 0) {
      this.dirs.add(parts.join("/"));
    }
  }

  async createDirectory(path: string) {
    this.dirs.add(path.trim().replace(/^\/+|\/+$/g, ""));
  }

  async listLocalFiles(dirPath: string): Promise<FileInfo[]> {
    const cleanDir = dirPath.trim().replace(/^\/+|\/+$/g, "");
    const results: FileInfo[] = [];

    // Find direct child directories
    for (const d of this.dirs) {
      if (cleanDir === "" && !d.includes("/")) {
        results.push({ name: d, path: d, isDirectory: true });
      } else if (d.startsWith(`${cleanDir}/`)) {
        const sub = d.slice(cleanDir.length + 1);
        if (!sub.includes("/")) {
          results.push({ name: sub, path: d, isDirectory: true });
        }
      }
    }

    // Find direct child files
    for (const [filePath] of this.files) {
      if (cleanDir === "" && !filePath.includes("/")) {
        results.push({ name: filePath, path: filePath, isDirectory: false });
      } else if (filePath.startsWith(`${cleanDir}/`)) {
        const sub = filePath.slice(cleanDir.length + 1);
        if (!sub.includes("/")) {
          results.push({ name: sub, path: filePath, isDirectory: false });
        }
      }
    }

    return results;
  }

  async listRemoteFiles(path: string) {
    return this.listLocalFiles(path);
  }

  async getFileUrl(path: string) {
    return `mock://${path}`;
  }

  async readFileText(path: string): Promise<string> {
    const cleanPath = path.trim().replace(/^\/+|\/+$/g, "");
    const file = this.files.get(cleanPath);
    if (!file) throw new Error(`File not found: ${cleanPath}`);
    return file.content;
  }

  async readFileBase64(path: string): Promise<string> {
    const cleanPath = path.trim().replace(/^\/+|\/+$/g, "");
    const file = this.files.get(cleanPath);
    if (!file) throw new Error(`File not found: ${cleanPath}`);
    if (file.isBase64) return file.content;
    const maybeBuffer = (globalThis as any).Buffer;
    if (maybeBuffer) {
      return maybeBuffer.from(file.content).toString("base64");
    }
    return btoa(file.content);
  }

  clear() {
    this.files.clear();
    this.dirs.clear();
  }

  getRawFile(path: string) {
    return this.files.get(path.trim().replace(/^\/+|\/+$/g, ""));
  }
}

describe("FormService", () => {
  let mockAdapter: MockStorageAdapter;

  beforeEach(() => {
    mockAdapter = new MockStorageAdapter();
    // Inject mock adapter into syncManager
    (syncManager as any).adapter = mockAdapter;
  });

  describe("generateSubmissionId", () => {
    it("should generate a clean human-readable submission ID", () => {
      const id1 = formService.generateSubmissionId("Daily Report");
      expect(id1.startsWith("Daily_Report_")).toBe(true);

      const id2 = formService.generateSubmissionId(
        "Equipment Check",
        "Truck 10",
      );
      expect(id2.startsWith("Equipment_Check_Truck_10_")).toBe(true);
    });
  });

  describe("Form Discovery & Template Loading", () => {
    it("should discover user-created forms across configured form folders", async () => {
      await formService.saveTemplate({
        ...TEST_REPORT_TEMPLATE,
        folderPath: "Reports/Daily Report",
      });
      await formService.saveTemplate({
        ...TEST_REPORT_TEMPLATE,
        id: "equipment-check",
        title: "Equipment Check",
        folderPath: "Inspections/Equipment Check",
      });

      const discovered = await formService.discoverForms([
        "Reports",
        "Inspections",
      ]);
      expect(discovered.length).toBe(2);

      const titles = discovered.map((d) => d.title);
      expect(titles).toContain("Daily Report");
      expect(titles).toContain("Equipment Check");
    });

    it("should discover direct form folders and load template", async () => {
      // Create template directly in folder "Daily Reports"
      await formService.saveTemplate({
        ...TEST_REPORT_TEMPLATE,
        folderPath: "Daily Reports",
      });

      // Verify discoverForms finds direct form folder
      const discovered = await formService.discoverForms(["Daily Reports"]);
      expect(discovered.length).toBe(1);
      expect(discovered[0].title).toBe("Daily Report");
      expect(discovered[0].folderPath).toBe("Daily Reports");

      // Verify loadTemplate loads it directly
      const loaded = await formService.loadTemplate("Daily Reports");
      expect(loaded).toBeDefined();
      expect(loaded?.title).toBe("Daily Report");
      expect(loaded?.folderPath).toBe("Daily Reports");
    });
  });

  describe("Save Submission & Dated PDF Export", () => {
    const testConfig: AppConfig = {
      theme: { primaryColor: "#0f172a", darkMode: "system" },
      branding: { appTitle: "Test Tablet App" },
      pdfPageSize: "a4",
    };

    it("should save submission JSON and export a dated PDF without overwriting older versions", async () => {
      const template = {
        ...TEST_REPORT_TEMPLATE,
        folderPath: "Reports/Daily Report",
      };
      const subId = "Daily_Report_2026-09-03_0800";

      const initialSubmission: FormSubmission = {
        id: subId,
        templateId: template.id,
        templateTitle: template.title,
        templateVersion: 1,
        folderPath: template.folderPath,
        createdAt: "2026-09-03T08:00:00.000Z",
        updatedAt: "2026-09-03T08:00:00.000Z",
        status: "completed",
        values: {
          work_date: "2026-09-03",
          shift: "day",
          supervisor_name: "John Smith",
          work_completed: "Morning shift inspection done.",
        },
        pdfExports: [],
      };

      // 1. Initial Save
      const save1 = await formService.saveSubmissionAndExportPdf(
        template,
        initialSubmission,
        testConfig,
      );

      expect(save1.pdfPath).toContain("Reports/Daily Report/Filled Forms/");
      expect(save1.filename.endsWith(".pdf")).toBe(true);

      // Verify the PDF file was saved with binary isBase64 flag
      const savedPdf1 = mockAdapter.getRawFile(save1.pdfPath);
      expect(savedPdf1).toBeDefined();
      expect(savedPdf1?.isBase64).toBe(true);

      // Verify submission JSON was saved
      const savedJson1 = await mockAdapter.readFileText(
        `Reports/Daily Report/Filled Forms/${subId}/${subId}.json`,
      );
      const parsedJson1 = JSON.parse(savedJson1);
      expect(parsedJson1.pdfExports.length).toBe(1);
      expect(parsedJson1.pdfExports[0].path).toBe(save1.pdfPath);

      // 2. Later Update to the same submission (e.g. afternoon addition)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const updatedSubmission: FormSubmission = {
        ...parsedJson1,
        values: {
          ...parsedJson1.values,
          delays_issues: "Afternoon weather delay.",
        },
      };

      const save2 = await formService.saveSubmissionAndExportPdf(
        template,
        updatedSubmission,
        testConfig,
      );

      // Verify second PDF file exists and has distinct path
      expect(save2.pdfPath).not.toBe(save1.pdfPath);
      const savedPdf2 = mockAdapter.getRawFile(save2.pdfPath);
      expect(savedPdf2).toBeDefined();
      expect(savedPdf2?.isBase64).toBe(true);

      // Verify original first PDF was NOT overwritten
      expect(mockAdapter.getRawFile(save1.pdfPath)).toBeDefined();

      // Verify the submission JSON now records both PDF exports
      const savedJson2 = await mockAdapter.readFileText(
        `Reports/Daily Report/Filled Forms/${subId}/${subId}.json`,
      );
      const parsedJson2 = JSON.parse(savedJson2);
      expect(parsedJson2.pdfExports.length).toBe(2);

      // 3. List submissions & PDFs
      const submissions = await formService.listSubmissions(
        "Reports/Daily Report",
      );
      expect(submissions.length).toBe(1);
      expect(submissions[0].id).toBe(subId);

      const pdfList = await formService.listPdfExports("Reports/Daily Report");
      expect(pdfList.length).toBeGreaterThanOrEqual(1);
    });

    it("should link identifier-based submission with its PDF in listSubmissions", async () => {
      const template = {
        ...TEST_REPORT_TEMPLATE,
        folderPath: "Reports/Daily Report",
      };
      const identifier = "Unit #402";
      const now = new Date(2026, 8, 4, 10, 0, 0);
      const subId = formService.generateSubmissionId(
        template.title,
        identifier,
        now,
      );

      const submission: FormSubmission = {
        id: subId,
        templateId: template.id,
        templateTitle: template.title,
        templateVersion: 1,
        folderPath: template.folderPath,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        status: "completed",
        values: {
          work_date: "2026-09-04",
          supervisor_name: "Unit #402",
        },
        pdfExports: [],
      };

      const save = await formService.saveSubmissionAndExportPdf(
        template,
        submission,
        testConfig,
      );

      expect(subId).toContain("Unit_402");
      expect(save.filename).toContain("Unit_402");
      expect(save.filename.endsWith(".pdf")).toBe(true);

      const listed = await formService.listSubmissions("Reports/Daily Report");
      const found = listed.find((s) => s.id === subId);
      expect(found).toBeDefined();
      expect(found?.pdfExports.length).toBeGreaterThanOrEqual(1);
      expect(found?.pdfExports[0].filename).toBe(save.filename);
    });

    it("should deduplicate folder names in getFormFoldersList", () => {
      const configWithDups: AppConfig = {
        theme: { primaryColor: "#000", darkMode: "system" },
        branding: { appTitle: "Test" },
        formFolders: {
          dailyReports: "SharedForms",
          incidentLogs: "SharedForms",
          equipmentChecks: "SharedForms/Checks",
        },
      };

      const list = getFormFoldersList(configWithDups);
      expect(list).toEqual(["SharedForms", "SharedForms/Checks"]);
      expect(list.length).toBe(2);
    });

    it("should create a valid empty template with defaults", () => {
      const empty = formService.createEmptyTemplate(
        "HVAC Audit",
        "Custom/HVAC",
      );
      expect(empty.title).toBe("HVAC Audit");
      expect(empty.folderPath).toBe("Custom/HVAC");
      expect(empty.sections.length).toBe(1);
      expect(empty.sections[0].fields.length).toBe(2);
      expect(empty.version).toBe(1);

      const validation = formService.validateTemplate(empty);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should validate invalid templates properly", () => {
      const invalid: any = {
        title: "",
        sections: [
          {
            title: "",
            fields: [
              { id: "dup", label: "", type: "text" },
              { id: "dup", label: "Duplicate", type: "select", options: [] },
            ],
          },
        ],
      };

      const result = formService.validateTemplate(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("title is required"))).toBe(
        true,
      );
      expect(result.errors.some((e) => e.includes("must have a label"))).toBe(
        true,
      );
      expect(result.errors.some((e) => e.includes("Duplicate field ID"))).toBe(
        true,
      );
      expect(
        result.errors.some((e) => e.includes("must have at least one option")),
      ).toBe(true);
    });

    it("should save and auto-version custom templates", async () => {
      const template = formService.createEmptyTemplate(
        "Safety Checklist",
        "Safety/Checklist",
      );

      // First save (v1)
      const saved1 = await formService.saveTemplate(template);
      expect(saved1.version).toBe(1);
      expect(saved1.folderPath).toBe("Safety/Checklist");

      // Verify file written
      const read1 = await mockAdapter.readFileText(
        "Safety/Checklist/form.json",
      );
      expect(JSON.parse(read1).version).toBe(1);

      // Second save / update (v2)
      const saved2 = await formService.saveTemplate({
        ...saved1,
        title: "Safety Checklist Updated",
      });
      expect(saved2.version).toBe(2);
      expect(saved2.title).toBe("Safety Checklist Updated");

      const read2 = await mockAdapter.readFileText(
        "Safety/Checklist/form.json",
      );
      expect(JSON.parse(read2).version).toBe(2);
    });

    it("should duplicate templates with fresh IDs and reset version", async () => {
      const original = await formService.saveTemplate({
        ...TEST_REPORT_TEMPLATE,
        folderPath: "Operations/Daily",
      });

      const cloned = await formService.duplicateTemplate(
        original,
        "Subcontractor Daily Report",
        "Operations/Subcontractor Daily",
      );

      expect(cloned.title).toBe("Subcontractor Daily Report");
      expect(cloned.folderPath).toBe("Operations/Subcontractor Daily");
      expect(cloned.version).toBe(1);
      expect(cloned.sections.length).toBe(original.sections.length);

      const readCloned = await mockAdapter.readFileText(
        "Operations/Subcontractor Daily/form.json",
      );
      expect(JSON.parse(readCloned).title).toBe("Subcontractor Daily Report");
    });

    it("should catch options with empty labels in validateTemplate", () => {
      const template = formService.createEmptyTemplate("Option Test", "Test");
      template.sections[0].fields.push({
        id: "choice_1",
        type: "select",
        label: "Priority",
        options: [
          { label: "High", value: "high" },
          { label: "   ", value: "empty" },
        ],
      });
      const result = formService.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes("option 2 must have a label")),
      ).toBe(true);
    });

    it("should keep original template intact when duplicating", async () => {
      const original = await formService.saveTemplate({
        ...TEST_REPORT_TEMPLATE,
        folderPath: "Reports/Daily",
      });

      await formService.duplicateTemplate(
        original,
        "Daily Copy",
        "Reports/Daily_Copy",
      );

      // Verify original is still intact in Reports/Daily
      const originalOnDisk = await formService.loadTemplate("Reports/Daily");
      expect(originalOnDisk?.title).toBe(TEST_REPORT_TEMPLATE.title);
      expect(originalOnDisk?.folderPath).toBe("Reports/Daily");

      // Verify cloned is in Reports/Daily_Copy
      const clonedOnDisk = await formService.loadTemplate("Reports/Daily_Copy");
      expect(clonedOnDisk?.title).toBe("Daily Copy");
      expect(clonedOnDisk?.folderPath).toBe("Reports/Daily_Copy");
    });

    it("should catch duplicate and empty option values in validateTemplate", () => {
      const template = formService.createEmptyTemplate("Values Test", "Test");
      template.sections[0].fields.push({
        id: "status_field",
        type: "select",
        label: "Status",
        options: [
          { label: "Active", value: "active" },
          { label: "Duplicate Active", value: "active" },
          { label: "Blank Value", value: "   " },
        ],
      });
      const result = formService.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("must have a value"))).toBe(
        true,
      );
      expect(
        result.errors.some((e) => e.includes("Duplicate option value")),
      ).toBe(true);
    });

    it("should catch number fields where min is greater than max", () => {
      const template = formService.createEmptyTemplate("Range Test", "Test");
      template.sections[0].fields.push({
        id: "reading",
        type: "number",
        label: "Pressure Reading",
        validation: { min: 100, max: 20 },
      });
      const result = formService.validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes("cannot be greater than max value"),
        ),
      ).toBe(true);
    });

    it("should track legacyFolderPaths and write _MOVED_TO.txt when folderPath is changed", async () => {
      const template = await formService.saveTemplate({
        ...TEST_REPORT_TEMPLATE,
        folderPath: "OldFolder",
      });

      // Now save with a new folder
      const moved = await formService.saveTemplate(template, "NewFolder");
      expect(moved.folderPath).toBe("NewFolder");
      expect(moved.legacyFolderPaths).toContain("OldFolder");

      // Verify _MOVED_TO.txt was written to OldFolder
      const noticeContent = await mockAdapter.readFileText(
        "OldFolder/_MOVED_TO.txt",
      );
      expect(noticeContent).toContain("/NewFolder");
    });

    it("should list submissions and pdfs across active and legacyFolderPaths", async () => {
      // 1. Create a submission in LegacyFolder
      await mockAdapter.createDirectory("LegacyFolder/Filled Forms");
      const oldSub: FormSubmission = {
        id: "Old_Sub_1",
        templateId: "test-daily-report",
        templateTitle: "Daily Report",
        templateVersion: 1,
        folderPath: "LegacyFolder",
        createdAt: "2026-09-01T10:00:00.000Z",
        updatedAt: "2026-09-01T10:00:00.000Z",
        status: "completed",
        values: {},
        pdfExports: [
          {
            path: "LegacyFolder/Filled Forms/Old_Sub_1.pdf",
            filename: "Old_Sub_1.pdf",
            exportedAt: "2026-09-01T10:00:00.000Z",
          },
        ],
      };
      await mockAdapter.saveFile(
        "LegacyFolder/Filled Forms/Old_Sub_1.json",
        JSON.stringify(oldSub),
      );
      await mockAdapter.saveFile(
        "LegacyFolder/Filled Forms/Old_Sub_1.pdf",
        "pdfcontent",
      );

      // 2. Create a submission in CurrentFolder
      await mockAdapter.createDirectory("CurrentFolder/Filled Forms");
      const currentSub: FormSubmission = {
        id: "Current_Sub_2",
        templateId: "test-daily-report",
        templateTitle: "Daily Report",
        templateVersion: 2,
        folderPath: "CurrentFolder",
        createdAt: "2026-09-02T10:00:00.000Z",
        updatedAt: "2026-09-02T10:00:00.000Z",
        status: "completed",
        values: {},
        pdfExports: [
          {
            path: "CurrentFolder/Filled Forms/Current_Sub_2.pdf",
            filename: "Current_Sub_2.pdf",
            exportedAt: "2026-09-02T10:00:00.000Z",
          },
        ],
      };
      await mockAdapter.saveFile(
        "CurrentFolder/Filled Forms/Current_Sub_2.json",
        JSON.stringify(currentSub),
      );
      await mockAdapter.saveFile(
        "CurrentFolder/Filled Forms/Current_Sub_2.pdf",
        "pdfcontent",
      );

      // 3. Query listSubmissions with legacyFolderPaths
      const subs = await formService.listSubmissions("CurrentFolder", [
        "LegacyFolder",
      ]);
      expect(subs.length).toBe(2);
      expect(subs.map((s) => s.id)).toEqual(["Current_Sub_2", "Old_Sub_1"]);

      // 4. Query listPdfExports with legacyFolderPaths
      const pdfs = await formService.listPdfExports("CurrentFolder", [
        "LegacyFolder",
      ]);
      expect(pdfs.length).toBe(2);
      expect(pdfs.map((p) => p.name)).toContain("Old_Sub_1.pdf");
      expect(pdfs.map((p) => p.name)).toContain("Current_Sub_2.pdf");
    });

    it("should filter out relocated forms and folders with _MOVED_TO.txt in discoverForms", async () => {
      // Create initial form in OldForms/Report
      await formService.saveTemplate({
        ...TEST_REPORT_TEMPLATE,
        folderPath: "OldForms/Report",
      });

      // Relocate form to NewForms/Report
      const original = await formService.loadTemplate("OldForms/Report");
      expect(original).toBeDefined();
      await formService.saveTemplate(original!, "NewForms/Report");

      // Now discoverForms under parent folders containing both
      const discovered = await formService.discoverForms([
        "OldForms",
        "NewForms",
      ]);

      // Should only discover the active one in NewForms/Report, not the moved ghost in OldForms/Report
      expect(discovered.length).toBe(1);
      expect(discovered[0].folderPath).toBe("NewForms/Report");
      expect(discovered[0].legacyFolderPaths).toContain("OldForms/Report");
    });

    it("should re-slug template ID when saving template with default new-field-form or new-form ID", async () => {
      const newTemplate = formService.createEmptyTemplate(
        "Warehouse Safety Audit",
        "Safety/Warehouse",
      );
      const editorCreatedTemplate: FormTemplate = {
        ...newTemplate,
        id: "new-field-form",
        title: "Warehouse Safety Audit",
      };

      const saved = await formService.saveTemplate(editorCreatedTemplate);
      expect(saved.id).toBe("warehouse_safety_audit");
    });

    it("should not create move notice when relocating from a nonexistent folder", async () => {
      const template = {
        ...TEST_REPORT_TEMPLATE,
        folderPath: "NonexistentFolder",
      };

      const saved = await formService.saveTemplate(template, "ActualFolder");
      expect(saved.folderPath).toBe("ActualFolder");
      // NonexistentFolder did not exist so _MOVED_TO.txt should not be written
      await expect(
        mockAdapter.readFileText("NonexistentFolder/_MOVED_TO.txt"),
      ).rejects.toThrow();
    });

    it("should create move notice when relocating even if legacyFolderPaths already contains previousFolder", async () => {
      // Save initial template in FolderA
      const t1 = await formService.saveTemplate({
        ...TEST_REPORT_TEMPLATE,
        folderPath: "FolderA",
      });

      // Move from FolderA to FolderB
      const t2 = await formService.saveTemplate(t1, "FolderB");
      expect(t2.legacyFolderPaths).toContain("FolderA");

      // Now move back from FolderB to FolderA
      const t3 = await formService.saveTemplate(t2, "FolderA");
      expect(t3.folderPath).toBe("FolderA");
      expect(t3.legacyFolderPaths).toContain("FolderB");

      // Verify move notice was written in FolderB
      const noticeB = await mockAdapter.readFileText("FolderB/_MOVED_TO.txt");
      expect(noticeB).toContain("/FolderA");
    });
  });

  describe("Photo & Video Attachments & Per-Instance Folder Persistence", () => {
    const mediaTemplate: FormTemplate = {
      id: "equipment-inspection",
      title: "Equipment Inspection",
      version: 1,
      createdAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:00:00.000Z",
      folderPath: "Inspections/Equipment",
      sections: [
        {
          id: "sec_media",
          title: "Media Attachments",
          fields: [
            {
              id: "unit_id",
              type: "text",
              label: "Unit ID",
              isIdentifier: true,
            },
            {
              id: "damage_photo",
              type: "photo",
              label: "Damage Photo",
              allowMultiple: true,
            },
            {
              id: "engine_sound",
              type: "video",
              label: "Engine Sound",
            },
          ],
        },
      ],
    };

    const testConfig: AppConfig = {
      theme: { primaryColor: "#000", darkMode: "light" },
      branding: { appTitle: "Test App" },
      pdfPageSize: "a4",
    };

    it("should co-locate submission JSON, dated PDF, and binary attachments in an instance folder", async () => {
      const subId = formService.generateSubmissionId(
        mediaTemplate.title,
        "Truck-99",
        new Date(2026, 8, 5, 8, 30, 0),
      );

      const fakePhotoBase64 =
        "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
      const fakeVideoBase64 = "dGVzdC12aWRlby1ieXRlcw==";

      const submission: FormSubmission = {
        id: subId,
        templateId: mediaTemplate.id,
        templateTitle: mediaTemplate.title,
        templateVersion: 1,
        folderPath: mediaTemplate.folderPath,
        createdAt: "2026-09-05T08:30:00.000Z",
        updatedAt: "2026-09-05T08:30:00.000Z",
        status: "completed",
        values: {
          unit_id: "Truck-99",
          damage_photo: [
            {
              id: "att_photo_1",
              name: "scratch.jpg",
              filename: "",
              path: "",
              type: "photo",
              mimeType: "image/jpeg",
              size: 2048,
              uploadedAt: "2026-09-05T08:30:00.000Z",
              dataUrl: `data:image/jpeg;base64,${fakePhotoBase64}`,
            },
          ],
          engine_sound: {
            id: "att_video_1",
            name: "rev_test.mp4",
            filename: "",
            path: "",
            type: "video",
            mimeType: "video/mp4",
            size: 5120,
            uploadedAt: "2026-09-05T08:30:00.000Z",
            dataUrl: `data:video/mp4;base64,${fakeVideoBase64}`,
          },
        },
        pdfExports: [],
      };

      const saveResult = await formService.saveSubmissionAndExportPdf(
        mediaTemplate,
        submission,
        testConfig,
      );

      const expectedInstanceDir = `Inspections/Equipment/Filled Forms/${subId}`;
      expect(saveResult.submission.instanceFolderPath).toBe(
        expectedInstanceDir,
      );

      // 1. Verify JSON is in instance folder
      const jsonText = await mockAdapter.readFileText(
        `${expectedInstanceDir}/${subId}.json`,
      );
      const savedJson = JSON.parse(jsonText);
      expect(savedJson.instanceFolderPath).toBe(expectedInstanceDir);
      expect(savedJson.attachments.length).toBe(2);

      // Verify bulky dataUrl is stripped from JSON
      expect(savedJson.values.damage_photo[0].dataUrl).toBeUndefined();
      expect(savedJson.values.engine_sound.dataUrl).toBeUndefined();

      // 2. Verify binary attachments are co-located in instance folder
      const savedPhotoFile = mockAdapter.getRawFile(
        `${expectedInstanceDir}/damage_photo_1.jpg`,
      );
      expect(savedPhotoFile).toBeDefined();
      expect(savedPhotoFile?.content).toBe(fakePhotoBase64);
      expect(savedPhotoFile?.isBase64).toBe(true);

      const savedVideoFile = mockAdapter.getRawFile(
        `${expectedInstanceDir}/engine_sound_1.mp4`,
      );
      expect(savedVideoFile).toBeDefined();
      expect(savedVideoFile?.content).toBe(fakeVideoBase64);
      expect(savedVideoFile?.isBase64).toBe(true);

      // 3. Verify dated PDF is co-located in instance folder
      expect(saveResult.pdfPath).toBe(
        `${expectedInstanceDir}/${saveResult.filename}`,
      );
      const savedPdf = mockAdapter.getRawFile(saveResult.pdfPath);
      expect(savedPdf).toBeDefined();

      // 4. Verify listSubmissions reads the instance folder submission
      const subs = await formService.listSubmissions("Inspections/Equipment");
      expect(subs.length).toBe(1);
      expect(subs[0].id).toBe(subId);
      expect(subs[0].instanceFolderPath).toBe(expectedInstanceDir);
      expect(subs[0].attachments?.length).toBe(2);

      // 5. Subsequent update saves inside the SAME instance folder with second dated PDF
      const updateSub: FormSubmission = {
        ...savedJson,
        values: {
          ...savedJson.values,
          unit_id: "Truck-99-Updated",
        },
      };

      const updateResult = await formService.saveSubmissionAndExportPdf(
        mediaTemplate,
        updateSub,
        testConfig,
      );

      expect(updateResult.submission.instanceFolderPath).toBe(
        expectedInstanceDir,
      );
      expect(updateResult.pdfPath).not.toBe(saveResult.pdfPath);
      expect(updateResult.submission.pdfExports.length).toBe(2);

      // Verify both dated PDFs exist in that same instance folder
      expect(mockAdapter.getRawFile(saveResult.pdfPath)).toBeDefined();
      const updatePdfFile = mockAdapter.getRawFile(updateResult.pdfPath);
      expect(updatePdfFile).toBeDefined();

      // Verify second PDF re-hydrated the photo from disk (filename appears in PDF)
      const updatePdfRaw = atob(updatePdfFile!.content);
      expect(updatePdfRaw).toContain("damage_photo_1.jpg");
    });
  });
});
