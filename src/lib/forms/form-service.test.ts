import { describe, it, expect, beforeEach } from "vitest";
import { formService } from "./form-service";
import { syncManager } from "../sync/sync-manager";
import type { StorageAdapter, FileInfo } from "../storage/adapter";
import { STARTER_DAILY_REPORT } from "./starter-templates";
import type { FormSubmission } from "../../types/form";
import type { AppConfig } from "../../store/config-store";

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

  describe("Form Discovery & Seeding", () => {
    it("should seed starter templates into a form folder", async () => {
      await formService.seedStarterTemplates("Reports");

      const dailyReportJson = await mockAdapter.readFileText(
        "Reports/Daily Report/form.json",
      );
      expect(dailyReportJson).toBeDefined();
      const parsed = JSON.parse(dailyReportJson);
      expect(parsed.title).toBe("Daily Report");
      expect(parsed.folderPath).toBe("Reports/Daily Report");
    });

    it("should discover seeded forms across configured form folders", async () => {
      await formService.seedStarterTemplates("Reports");
      await formService.seedStarterTemplates("Inspections");

      const discovered = await formService.discoverForms([
        "Reports",
        "Inspections",
      ]);
      expect(discovered.length).toBeGreaterThanOrEqual(3);

      const titles = discovered.map((d) => d.title);
      expect(titles).toContain("Daily Report");
      expect(titles).toContain("Incident Log");
      expect(titles).toContain("Equipment Check");
    });

    it("should get or create template and discover direct form folders", async () => {
      // Create template directly in folder "Daily Reports"
      const template = await formService.getOrCreateTemplate(
        "dailyReports",
        "Daily Reports",
      );
      expect(template.title).toBe("Daily Report");
      expect(template.folderPath).toBe("Daily Reports");

      // Verify form.json was persisted
      const savedJson = await mockAdapter.readFileText(
        "Daily Reports/form.json",
      );
      expect(JSON.parse(savedJson).title).toBe("Daily Report");

      // Verify discoverForms finds direct form folder
      const discovered = await formService.discoverForms(["Daily Reports"]);
      expect(discovered.length).toBe(1);
      expect(discovered[0].title).toBe("Daily Report");
      expect(discovered[0].folderPath).toBe("Daily Reports");
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
        ...STARTER_DAILY_REPORT,
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
        `Reports/Daily Report/Filled Forms/${subId}.json`,
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
        `Reports/Daily Report/Filled Forms/${subId}.json`,
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
        ...STARTER_DAILY_REPORT,
        folderPath: "Reports/Daily Report",
      };
      const identifier = "Unit #402";
      const now = new Date(2026, 8, 4, 10, 0, 0);
      const subId = formService.generateSubmissionId(template.title, identifier, now);

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
  });
});
