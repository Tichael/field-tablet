import { describe, it, expect } from "vitest";
import {
  generateFormSubmissionPdf,
  generateDatedPdfFilename,
  sanitizeFilenamePart,
  formatDateTime,
} from "./pdf-generator";
import type { FormSubmission, FormTemplate } from "../../types/form";
import type { AppConfig } from "../../store/config-store";

const TEST_REPORT_TEMPLATE: FormTemplate = {
  id: "daily-report",
  title: "Daily Report",
  version: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  folderPath: "Reports/Daily Report",
  sections: [
    {
      id: "general",
      title: "General Information",
      fields: [
        { id: "work_date", type: "date", label: "Date" },
        {
          id: "shift",
          type: "select",
          label: "Shift",
          options: [{ label: "Day Shift", value: "day" }],
        },
        {
          id: "supervisor_name",
          type: "text",
          label: "Supervisor",
          isIdentifier: true,
        },
        { id: "site_location", type: "text", label: "Location" },
        { id: "weather_conditions", type: "text", label: "Weather" },
        { id: "crew_size", type: "number", label: "Crew Size" },
        { id: "work_completed", type: "textarea", label: "Work Completed" },
        { id: "delays_issues", type: "textarea", label: "Delays" },
        { id: "safety_incident_occurred", type: "checkbox", label: "Incident" },
        { id: "signature", type: "signature", label: "Signature" },
      ],
    },
  ],
};

const TEST_EQUIPMENT_TEMPLATE: FormTemplate = {
  id: "equipment-check",
  title: "Equipment Check",
  version: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  folderPath: "Inspections/Equipment Check",
  sections: [
    {
      id: "equipment_info",
      title: "Equipment Information",
      fields: [
        {
          id: "equipment_id",
          type: "text",
          label: "Equipment ID",
          isIdentifier: true,
        },
        { id: "serial_number", type: "text", label: "Serial Number" },
        { id: "hour_meter", type: "number", label: "Hour Meter" },
        { id: "inspector_name", type: "text", label: "Inspector" },
        { id: "fluids_check", type: "select", label: "Fluids" },
        { id: "hydraulics_check", type: "select", label: "Hydraulics" },
        { id: "tires_tracks_check", type: "select", label: "Tires" },
        { id: "safety_guards_check", type: "checkbox", label: "Guards" },
        { id: "emergency_stop_check", type: "checkbox", label: "E-Stop" },
        { id: "overall_status", type: "select", label: "Status" },
        { id: "inspector_comments", type: "textarea", label: "Comments" },
        { id: "signature", type: "signature", label: "Signature" },
      ],
    },
  ],
};

const TEST_INCIDENT_TEMPLATE: FormTemplate = {
  id: "incident-log",
  title: "Incident Log",
  version: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  folderPath: "Reports/Incident Log",
  sections: [
    {
      id: "incident_details",
      title: "Incident Details",
      fields: [
        { id: "incident_datetime", type: "datetime", label: "Date & Time" },
        { id: "incident_type", type: "radio", label: "Type" },
        { id: "severity", type: "radio", label: "Severity" },
        { id: "location", type: "text", label: "Location", isIdentifier: true },
        { id: "description", type: "textarea", label: "Description" },
        {
          id: "immediate_actions",
          type: "textarea",
          label: "Immediate Actions",
        },
        { id: "reporter_name", type: "text", label: "Reporter" },
      ],
    },
  ],
};

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

    it("should strip URL-breaking characters such as # and %", () => {
      expect(sanitizeFilenamePart("Truck #42 (100% inspected)")).toBe(
        "Truck_42_100_inspected",
      );
      expect(sanitizeFilenamePart("..file.name..")).toBe("file.name");
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
    it("should generate dated filename with second precision without UUID", () => {
      const testDate = new Date(2026, 8, 3, 14, 30, 15);
      const filename = generateDatedPdfFilename(
        "Daily Report",
        undefined,
        testDate,
      );
      expect(filename).toBe("Daily_Report_2026-09-03_143015.pdf");
    });

    it("should include sanitized key identifier when provided", () => {
      const testDate = new Date(2026, 8, 3, 16, 45, 0);
      const filename = generateDatedPdfFilename(
        "Equipment Check",
        "Truck #42",
        testDate,
      );
      expect(filename).toBe("Equipment_Check_Truck_42_2026-09-03_164500.pdf");
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
        id: "Daily_Report_2026-09-03_080000",
        templateId: TEST_REPORT_TEMPLATE.id,
        templateTitle: TEST_REPORT_TEMPLATE.title,
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
          delays_issues: "None.",
          safety_incident_occurred: false,
          signature: transparentPng,
        },
        pdfExports: [],
      };

      const result = await generateFormSubmissionPdf({
        template: TEST_REPORT_TEMPLATE,
        submission,
        config: sampleConfig,
        exportDate: new Date(2026, 8, 3, 8, 0, 0),
      });

      expect(result.filename).toBe(
        "Daily_Report_Sarah_Connor_2026-09-03_080000.pdf",
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
        id: "Equipment_Check_2026-09-03_103000",
        templateId: TEST_EQUIPMENT_TEMPLATE.id,
        templateTitle: TEST_EQUIPMENT_TEMPLATE.title,
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
        template: TEST_EQUIPMENT_TEMPLATE,
        submission,
        config: letterConfig,
        exportDate: new Date(2026, 8, 3, 10, 30, 0),
      });

      expect(result.filename).toBe(
        "Equipment_Check_CAT-Gen-300_2026-09-03_103000.pdf",
      );
      const header = atob(result.base64.slice(0, 30));
      expect(header.startsWith("%PDF")).toBe(true);
    });

    it("should handle Incident Log form with radio and textarea fields", async () => {
      const submission: FormSubmission = {
        id: "Incident_Log_2026-09-03_140000",
        templateId: TEST_INCIDENT_TEMPLATE.id,
        templateTitle: TEST_INCIDENT_TEMPLATE.title,
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
        template: TEST_INCIDENT_TEMPLATE,
        submission,
        config: sampleConfig,
        exportDate: new Date(2026, 8, 3, 14, 0, 0),
      });

      expect(result.filename).toBe(
        "Incident_Log_Workshop_Bay_2_2026-09-03_140000.pdf",
      );
      const header = atob(result.base64.slice(0, 30));
      expect(header.startsWith("%PDF")).toBe(true);
    });

    it("should map checkbox-group values to human-readable option labels in PDF output", async () => {
      const templateWithCheckboxGroup = {
        ...TEST_REPORT_TEMPLATE,
        sections: [
          {
            id: "ppe_section",
            title: "Safety Equipment",
            fields: [
              {
                id: "ppe_used",
                type: "checkbox-group" as const,
                label: "PPE Used Onsite",
                options: [
                  { label: "High-Vis Vest", value: "vest" },
                  { label: "Steel-Toe Boots", value: "boots" },
                  { label: "Hard Hat", value: "hardhat" },
                ],
              },
            ],
          },
        ],
      };

      const submission: FormSubmission = {
        id: "Daily_Report_2026-09-03_090000",
        templateId: templateWithCheckboxGroup.id,
        templateTitle: templateWithCheckboxGroup.title,
        templateVersion: 1,
        folderPath: "Reports/Daily Report",
        createdAt: "2026-09-03T09:00:00.000Z",
        updatedAt: "2026-09-03T09:00:00.000Z",
        status: "completed",
        values: {
          ppe_used: ["vest", "hardhat"],
        },
        pdfExports: [],
      };

      const result = await generateFormSubmissionPdf({
        template: templateWithCheckboxGroup,
        submission,
        config: sampleConfig,
        exportDate: new Date(2026, 8, 3, 9, 0, 0),
      });

      expect(result.filename).toBe("Daily_Report_2026-09-03_090000.pdf");
      const pdfText = atob(result.base64);
      expect(pdfText).toContain("High-Vis Vest, Hard Hat");
    });

    it("should use ASCII hyphen for empty fields and pipe delimiter in footer", async () => {
      const emptySubmission: FormSubmission = {
        id: "Daily_Report_2026-09-03_120000",
        templateId: TEST_REPORT_TEMPLATE.id,
        templateTitle: TEST_REPORT_TEMPLATE.title,
        templateVersion: 1,
        folderPath: "Reports/Daily Report",
        createdAt: "2026-09-03T12:00:00.000Z",
        updatedAt: "2026-09-03T12:00:00.000Z",
        status: "completed",
        values: {},
        pdfExports: [],
      };

      const result = await generateFormSubmissionPdf({
        template: TEST_REPORT_TEMPLATE,
        submission: emptySubmission,
        config: sampleConfig,
        exportDate: new Date(2026, 8, 3, 12, 0, 0),
      });

      const pdfText = atob(result.base64);
      expect(pdfText).toContain("Field Inspection Pro | Daily Report");
      expect(pdfText).not.toContain("•");
    });

    it("should render photo attachments and video reference cards with SMB share paths in PDF", async () => {
      const mediaTemplate: FormTemplate = {
        id: "site-inspection",
        title: "Site Inspection",
        version: 1,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        folderPath: "Inspections/Site Inspection",
        sections: [
          {
            id: "media_section",
            title: "Inspection Media",
            fields: [
              {
                id: "damage_photo",
                type: "photo",
                label: "Damage Photo",
                allowMultiple: true,
              },
              {
                id: "engine_video",
                type: "video",
                label: "Engine Test Video",
              },
            ],
          },
        ],
      };

      const tinyJpeg =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

      const submission: FormSubmission = {
        id: "Site_Inspection_Unit1_2026-09-05_100000",
        templateId: mediaTemplate.id,
        templateTitle: mediaTemplate.title,
        templateVersion: 1,
        folderPath: mediaTemplate.folderPath,
        instanceFolderPath:
          "Inspections/Site Inspection/Filled Forms/Site_Inspection_Unit1_2026-09-05_100000",
        createdAt: "2026-09-05T10:00:00.000Z",
        updatedAt: "2026-09-05T10:00:00.000Z",
        status: "completed",
        values: {
          damage_photo: [
            {
              id: "photo_1",
              name: "crack_detail.jpg",
              filename: "Damage_Photo_1.jpg",
              path: "Inspections/Site Inspection/Filled Forms/Site_Inspection_Unit1_2026-09-05_100000/Damage_Photo_1.jpg",
              type: "photo",
              mimeType: "image/jpeg",
              size: 204800,
              uploadedAt: "2026-09-05T10:00:00.000Z",
              dataUrl: tinyJpeg,
            },
          ],
          engine_video: {
            id: "video_1",
            name: "engine_rev.mp4",
            filename: "Engine_Test_Video_1.mp4",
            path: "Inspections/Site Inspection/Filled Forms/Site_Inspection_Unit1_2026-09-05_100000/Engine_Test_Video_1.mp4",
            type: "video",
            mimeType: "video/mp4",
            size: 15728640, // 15 MB
            uploadedAt: "2026-09-05T10:00:00.000Z",
          },
        },
        pdfExports: [],
      };

      const result = await generateFormSubmissionPdf({
        template: mediaTemplate,
        submission,
        config: sampleConfig,
        exportDate: new Date(2026, 8, 5, 10, 0, 0),
      });

      expect(result.filename).toBe("Site_Inspection_2026-09-05_100000.pdf");
      const pdfRaw = atob(result.base64);
      expect(pdfRaw.startsWith("%PDF")).toBe(true);

      // Verify video reference card and SMB path are printed
      expect(pdfRaw).toContain("[VIDEO] engine_rev.mp4");
      expect(pdfRaw).toContain("15 MB");
      expect(pdfRaw).toContain(
        "Path on Share: /Inspections/Site Inspection/Filled Forms/Site_Inspection_Unit1_2026-09-05_100000/Engine_Test_Video_1.mp4",
      );

      // Verify photo filename appears
      expect(pdfRaw).toContain("Damage_Photo_1.jpg");
    });

    it("should handle long photo and video names with maxWidth wrapping without error", async () => {
      const mediaTemplate: FormTemplate = {
        id: "site-inspection-long",
        title: "Site Inspection Long",
        version: 1,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-01T00:00:00.000Z",
        folderPath: "Inspections/Site Inspection",
        sections: [
          {
            id: "sec1",
            title: "Media",
            fields: [
              {
                id: "damage_photo",
                type: "photo",
                label: "Damage Photo",
              },
              {
                id: "engine_video",
                type: "video",
                label: "Engine Video",
              },
            ],
          },
        ],
      };

      const tinyJpeg =
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

      const submission: FormSubmission = {
        id: "Long_Name_Sub_1",
        templateId: mediaTemplate.id,
        templateTitle: mediaTemplate.title,
        templateVersion: 1,
        folderPath: mediaTemplate.folderPath,
        createdAt: "2026-09-05T10:00:00.000Z",
        updatedAt: "2026-09-05T10:00:00.000Z",
        status: "completed",
        values: {
          damage_photo: {
            id: "p1",
            name: "Extremely_Long_Photo_Filename_Describing_The_Full_Crack_Measurement_On_Northern_Facade_Section_4.jpg",
            filename:
              "Extremely_Long_Photo_Filename_Describing_The_Full_Crack_Measurement_On_Northern_Facade_Section_4.jpg",
            path: "Inspections/Site Inspection/Filled Forms/Long_Name_Sub_1/damage_photo_1.jpg",
            type: "photo",
            mimeType: "image/jpeg",
            size: 204800,
            uploadedAt: "2026-09-05T10:00:00.000Z",
            dataUrl: tinyJpeg,
          },
          engine_video: {
            id: "v1",
            name: "Extremely_Long_Video_Filename_Recording_Unusual_Vibration_Noise_From_Secondary_Bearing.mp4",
            filename: "engine_video_1.mp4",
            path: "Inspections/Site Inspection/Filled Forms/Long_Name_Sub_1/engine_video_1.mp4",
            type: "video",
            mimeType: "video/mp4",
            size: 15728640,
            uploadedAt: "2026-09-05T10:00:00.000Z",
          },
        },
        pdfExports: [],
      };

      const result = await generateFormSubmissionPdf({
        template: mediaTemplate,
        submission,
        config: sampleConfig,
        exportDate: new Date(2026, 8, 5, 10, 0, 0),
      });

      expect(result.base64).toBeDefined();
      const pdfRaw = atob(result.base64);
      expect(pdfRaw.startsWith("%PDF")).toBe(true);
    });
  });
});
