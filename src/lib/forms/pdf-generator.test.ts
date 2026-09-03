import { describe, it, expect } from "vitest";
import {
  generateFormSubmissionPdf,
  generateDatedPdfFilename,
  sanitizeFilenamePart,
  formatDateTime,
} from "./pdf-generator";
import {
  STARTER_DAILY_REPORT,
  STARTER_INCIDENT_LOG,
  STARTER_EQUIPMENT_CHECK,
} from "./starter-templates";
import type { FormSubmission } from "../../types/form";
import type { AppConfig } from "../../store/config-store";

describe("pdf-generator", () => {
  describe("sanitizeFilenamePart", () => {
    it("should strip forbidden file system characters", () => {
      expect(sanitizeFilenamePart("Daily: Report / Unit * 12 ?")).toBe(
        "Daily_Report_Unit_12",
      );
      expect(sanitizeFilenamePart('File<Name>"With|Bad\\Chars')).toBe(
        "FileNameWithBadChars",
      );
    });

    it("should replace whitespace and multiple underscores with single underscore", () => {
      expect(sanitizeFilenamePart("Daily   Work   Report")).toBe(
        "Daily_Work_Report",
      );
      expect(sanitizeFilenamePart("___Test___Title___")).toBe("Test_Title");
    });
  });

  describe("formatDateTime", () => {
    it("should format date parts with two-digit padding", () => {
      const date = new Date(2026, 8, 3, 9, 5, 2); // Sept 3, 2026 09:05:02
      const formatted = formatDateTime(date);
      expect(formatted.dateStr).toBe("2026-09-03");
      expect(formatted.timeStr).toBe("0905");
      expect(formatted.timeFullStr).toBe("090502");
    });
  });

  describe("generateDatedPdfFilename", () => {
    it("should generate dated filename without UUID", () => {
      const testDate = new Date(2026, 8, 3, 14, 30);
      const filename = generateDatedPdfFilename(
        "Daily Report",
        undefined,
        testDate,
      );
      expect(filename).toBe("Daily_Report_2026-09-03_1430.pdf");
    });

    it("should include key identifier when provided", () => {
      const testDate = new Date(2026, 8, 3, 16, 45);
      const filename = generateDatedPdfFilename(
        "Equipment Check",
        "Truck #42",
        testDate,
      );
      expect(filename).toBe("Equipment_Check_Truck_#42_2026-09-03_1645.pdf");
    });
  });

  describe("generateFormSubmissionPdf", () => {
    const sampleConfig: AppConfig = {
      theme: {
        primaryColor: "#0284c7",
        darkMode: "light",
      },
      branding: {
        appTitle: "Field Inspection Pro",
      },
      pdfPageSize: "a4",
    };

    const transparentPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    it("should generate a valid vector PDF in A4 format with signature and fields", async () => {
      const submission: FormSubmission = {
        id: "Daily_Report_2026-09-03_0800",
        templateId: STARTER_DAILY_REPORT.id,
        templateTitle: STARTER_DAILY_REPORT.title,
        templateVersion: 1,
        folderPath: "Reports/Daily Report",
        createdAt: "2026-09-03T08:00:00.000Z",
        updatedAt: "2026-09-03T08:00:00.000Z",
        status: "completed",
        values: {
          work_date: "2026-09-03",
          shift: "day",
          supervisor_name: "Sarah Connor",
          site_location: "Substation B - Sector 7",
          weather_conditions: "clear",
          crew_size: 5,
          work_completed:
            "Completed transformer inspection and thermography scan.",
          delays_issues: "None",
          safety_incident_occurred: false,
          signature: transparentPng,
        },
        pdfExports: [],
      };

      const result = await generateFormSubmissionPdf({
        template: STARTER_DAILY_REPORT,
        submission,
        config: sampleConfig,
        exportDate: new Date(2026, 8, 3, 8, 0),
      });

      expect(result.filename).toBe(
        "Daily_Report_Sarah_Connor_2026-09-03_0800.pdf",
      );
      expect(result.base64).toBeDefined();
      expect(result.base64.length).toBeGreaterThan(1000);

      // Verify %PDF header in base64
      const header = atob(result.base64.slice(0, 30));
      expect(header.startsWith("%PDF")).toBe(true);
    });

    it("should support Letter page size and multiple field types", async () => {
      const letterConfig: AppConfig = {
        ...sampleConfig,
        pdfPageSize: "letter",
      };

      const submission: FormSubmission = {
        id: "Equipment_Check_2026-09-03_1030",
        templateId: STARTER_EQUIPMENT_CHECK.id,
        templateTitle: STARTER_EQUIPMENT_CHECK.title,
        templateVersion: 1,
        folderPath: "Inspections/Equipment Check",
        createdAt: "2026-09-03T10:30:00.000Z",
        updatedAt: "2026-09-03T10:30:00.000Z",
        status: "completed",
        values: {
          equipment_id: "CAT-Gen-300",
          serial_number: "SN-44321",
          hour_meter: 1240,
          inspector_name: "Mark Stone",
          fluids_check: "pass",
          hydraulics_check: "pass",
          tires_tracks_check: "attention",
          safety_guards_check: true,
          emergency_stop_check: true,
          overall_status: "safe",
          inspector_comments:
            "Tire tread wear normal. Safe for standard operation.",
          signature: transparentPng,
        },
        pdfExports: [],
      };

      const result = await generateFormSubmissionPdf({
        template: STARTER_EQUIPMENT_CHECK,
        submission,
        config: letterConfig,
        exportDate: new Date(2026, 8, 3, 10, 30),
      });

      expect(result.filename).toBe(
        "Equipment_Check_CAT-Gen-300_2026-09-03_1030.pdf",
      );
      const header = atob(result.base64.slice(0, 30));
      expect(header.startsWith("%PDF")).toBe(true);
    });

    it("should handle Incident Log form with radio and textarea fields", async () => {
      const submission: FormSubmission = {
        id: "Incident_Log_2026-09-03_1400",
        templateId: STARTER_INCIDENT_LOG.id,
        templateTitle: STARTER_INCIDENT_LOG.title,
        templateVersion: 1,
        folderPath: "Reports/Incident Log",
        createdAt: "2026-09-03T14:00:00.000Z",
        updatedAt: "2026-09-03T14:00:00.000Z",
        status: "draft",
        values: {
          incident_datetime: "2026-09-03T13:45",
          incident_type: "near_miss",
          severity: "low",
          location: "Workshop Bay 2",
          description:
            "Unsecured ladder slipped while technician was descending.",
          immediate_actions: "Ladder tagged out; safety briefing conducted.",
          reporter_name: "John Doe",
        },
        pdfExports: [],
      };

      const result = await generateFormSubmissionPdf({
        template: STARTER_INCIDENT_LOG,
        submission,
        config: sampleConfig,
        exportDate: new Date(2026, 8, 3, 14, 0),
      });

      expect(result.filename).toBe(
        "Incident_Log_Workshop_Bay_2_2026-09-03_1400.pdf",
      );
      const header = atob(result.base64.slice(0, 30));
      expect(header.startsWith("%PDF")).toBe(true);
    });
  });
});
