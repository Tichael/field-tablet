import { jsPDF } from "jspdf";
import type { FormTemplate, FormSubmission } from "../../types/form";
import type { AppConfig } from "../../store/config-store";
import { formatBytes } from "./media-utils";
import i18n from "../../i18n";

export interface GeneratePdfOptions {
  template: FormTemplate;
  submission: FormSubmission;
  config: AppConfig;
  exportDate?: Date;
}

export interface GeneratedPdfResult {
  base64: string;
  filename: string;
}

/**
 * Format a Date object into human-readable date and time parts.
 */
export function formatDateTime(date: Date, lang: string = "en") {
  const locale = lang === "fr-CA" || lang.startsWith("fr") ? "fr-CA" : "en-US";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return {
    dateStr: `${year}-${month}-${day}`,
    timeStr: `${hours}${minutes}`,
    timeFullStr: `${hours}${minutes}${seconds}`,
    displayDate: date.toLocaleDateString(locale),
    displayTime: date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

/**
 * Sanitize strings for safe file and directory naming across Windows/Linux/SMB.
 */
export function sanitizeFilenamePart(text: string): string {
  return text
    .trim()
    .replace(/[/\\:*?"<>|#%&`'$;{}@^~!=+()[\]]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^\.+|\.+$/g, "");
}

/**
 * Generates a clean, dated PDF filename without cryptic UUIDs.
 * Example: Daily_Report_2026-09-03_143000.pdf
 * Or with identifier: Equipment_Check_Unit-402_2026-09-03_143000.pdf
 */
export function generateDatedPdfFilename(
  formTitle: string,
  identifierValue?: string,
  date: Date = new Date(),
): string {
  const cleanTitle = sanitizeFilenamePart(formTitle) || "Form";
  const { dateStr, timeFullStr } = formatDateTime(date);

  if (identifierValue && identifierValue.trim()) {
    const cleanId = sanitizeFilenamePart(identifierValue);
    if (cleanId) {
      return `${cleanTitle}_${cleanId}_${dateStr}_${timeFullStr}.pdf`;
    }
  }

  return `${cleanTitle}_${dateStr}_${timeFullStr}.pdf`;
}

/**
 * Client-side vector PDF generator using jsPDF.
 */
export async function generateFormSubmissionPdf({
  template,
  submission,
  config,
  exportDate = new Date(),
}: GeneratePdfOptions): Promise<GeneratedPdfResult> {
  const pdfLang = config.language || "en";
  const t = i18n.getFixedT(pdfLang);
  const pageSize = config.pdfPageSize === "letter" ? "letter" : "a4";
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: pageSize,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 20;

  let y = margin;

  // Primary color parsing
  let primaryR = 15;
  let primaryG = 23;
  let primaryB = 42;
  if (config.theme?.primaryColor?.startsWith("#")) {
    const hex = config.theme.primaryColor.replace("#", "");
    if (hex.length === 6) {
      primaryR = parseInt(hex.substring(0, 2), 16);
      primaryG = parseInt(hex.substring(2, 4), 16);
      primaryB = parseInt(hex.substring(4, 6), 16);
    }
  }

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // Header Banner
  doc.setFillColor(primaryR, primaryG, primaryB);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, "F");

  // Logo if available
  let textStartX = margin + 4;
  if (config.branding?.logoBase64) {
    try {
      doc.addImage(
        config.branding.logoBase64,
        "PNG",
        margin + 4,
        y + 3,
        16,
        16,
        undefined,
        "FAST",
      );
      textStartX = margin + 24;
    } catch {
      // If logo fails to parse, proceed without it
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(
    config.branding?.appTitle || t("header.fieldTabletApp"),
    textStartX,
    y + 9,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.text(t("pdf.submissionReport"), textStartX, y + 16);

  // Status badge on header right
  const isCompleted = submission.status === "completed";
  const badgeText = isCompleted ? t("pdf.completed") : t("pdf.draft");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const badgeWidth = doc.getTextWidth(badgeText) + 8;
  const badgeX = margin + contentWidth - badgeWidth - 4;
  doc.setFillColor(
    isCompleted ? 34 : 217,
    isCompleted ? 197 : 119,
    isCompleted ? 94 : 6,
  );
  doc.roundedRect(badgeX, y + 5, badgeWidth, 12, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(badgeText, badgeX + 4, y + 13);

  y += 27;

  // Document Summary Block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(template.title, margin + 4, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);

  const { displayDate, displayTime } = formatDateTime(exportDate, pdfLang);
  const createdDate = new Date(submission.createdAt || exportDate);
  const { displayDate: subDisplayDate, displayTime: subDisplayTime } =
    formatDateTime(createdDate, pdfLang);

  doc.text(
    t("pdf.submittedAt", { date: subDisplayDate, time: subDisplayTime }),
    margin + 4,
    y + 14,
  );
  doc.text(
    t("pdf.exportedAt", { date: displayDate, time: displayTime }),
    margin + 4,
    y + 20,
  );

  doc.text(
    t("pdf.templateVersion", { version: template.version || 1 }),
    margin + contentWidth / 2,
    y + 14,
  );
  doc.text(
    t("pdf.reference", { id: submission.id }),
    margin + contentWidth / 2,
    y + 20,
  );

  y += 28;

  // Sections & Fields
  for (const section of template.sections) {
    checkPageBreak(18);

    // Section Header
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, contentWidth, 8, 1, 1, "F");
    doc.setFillColor(primaryR, primaryG, primaryB);
    doc.rect(margin, y, 2, 8, "F");

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(section.title, margin + 5, y + 5.5);
    y += 11;

    if (section.description) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const descLines = doc.splitTextToSize(section.description, contentWidth);
      checkPageBreak(descLines.length * 4);
      doc.text(descLines, margin, y);
      y += descLines.length * 4 + 2;
    }

    // Fields in Section
    for (const field of section.fields) {
      if (field.type === "heading") {
        checkPageBreak(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(primaryR, primaryG, primaryB);
        doc.text(field.label, margin, y + 4);
        y += 8;
        continue;
      }

      if (field.type === "notes") {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        const noteLines = doc.splitTextToSize(field.label, contentWidth);
        checkPageBreak(noteLines.length * 4 + 2);
        doc.text(noteLines, margin, y + 3);
        y += noteLines.length * 4 + 4;
        continue;
      }

      const val = submission.values[field.id];

      // Handle Signature Field
      if (field.type === "signature") {
        checkPageBreak(32);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(field.label, margin, y + 4);

        if (val && typeof val === "string" && val.startsWith("data:image")) {
          try {
            doc.setDrawColor(226, 232, 240);
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(margin, y + 6, 70, 22, 1, 1, "FD");
            doc.addImage(
              val,
              "PNG",
              margin + 1,
              y + 7,
              68,
              20,
              undefined,
              "FAST",
            );
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(148, 163, 184);
            doc.text(
              t("pdf.digitallySigned", { date: displayDate }),
              margin + 74,
              y + 18,
            );
            y += 31;
          } catch {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(8);
            doc.setTextColor(148, 163, 184);
            doc.text(t("pdf.signatureCaptured"), margin, y + 10);
            y += 14;
          }
        } else {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(t("pdf.noSignature"), margin, y + 10);
          y += 14;
        }
        continue;
      }

      // Handle Photo Field
      if (field.type === "photo") {
        const photoList: any[] = Array.isArray(val) ? val : val ? [val] : [];
        const labelText = field.required ? `${field.label} *` : field.label;

        checkPageBreak(photoList.length > 0 ? 55 : 16);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(labelText, margin, y + 4);
        y += 7;

        if (photoList.length === 0) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(t("pdf.noPhotos"), margin, y + 2);
          y += 8;
        } else {
          for (let pi = 0; pi < photoList.length; pi++) {
            const p = photoList[pi];
            const imgSrc =
              p.dataUrl ||
              (typeof p === "string" && p.startsWith("data:image") ? p : null);
            const photoName = p.name || p.filename || `Photo ${pi + 1}`;
            const photoSize = p.size ? ` (${formatBytes(p.size)})` : "";

            if (imgSrc) {
              checkPageBreak(52);
              try {
                doc.setDrawColor(226, 232, 240);
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(margin, y, 70, 44, 1.5, 1.5, "FD");

                const maxW = 68;
                const maxH = 42;
                let imgW = maxW;
                let imgH = maxH;
                let imgX = margin + 1;
                let imgY = y + 1;

                try {
                  const props = doc.getImageProperties(imgSrc);
                  if (props && props.width && props.height) {
                    const ratio = props.width / props.height;
                    if (ratio > maxW / maxH) {
                      imgW = maxW;
                      imgH = maxW / ratio;
                      imgY = y + 1 + (maxH - imgH) / 2;
                    } else {
                      imgH = maxH;
                      imgW = maxH * ratio;
                      imgX = margin + 1 + (maxW - imgW) / 2;
                    }
                  }
                } catch {
                  // Fallback to bounding box dimensions
                }

                doc.addImage(
                  imgSrc,
                  undefined as any,
                  imgX,
                  imgY,
                  imgW,
                  imgH,
                  undefined,
                  "FAST",
                );

                doc.setFont("helvetica", "normal");
                doc.setFontSize(7.5);
                doc.setTextColor(100, 116, 139);
                doc.text(`${photoName}${photoSize}`, margin + 74, y + 10, {
                  maxWidth: contentWidth - 76,
                });
                doc.text(
                  `File: ${p.filename || photoName}`,
                  margin + 74,
                  y + 16,
                  { maxWidth: contentWidth - 76 },
                );

                y += 48;
              } catch {
                doc.setFont("helvetica", "italic");
                doc.setFontSize(8);
                doc.setTextColor(148, 163, 184);
                doc.text(
                  `[Photo: ${p.filename || photoName}${photoSize}]`,
                  margin,
                  y + 4,
                  {
                    maxWidth: contentWidth,
                  },
                );
                y += 10;
              }
            } else {
              checkPageBreak(16);
              doc.setFillColor(248, 250, 252);
              doc.setDrawColor(226, 232, 240);
              doc.roundedRect(margin, y, contentWidth, 12, 1, 1, "FD");
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8);
              doc.setTextColor(51, 65, 85);
              doc.text(
                `Attached Photo: ${photoName}${photoSize} — Stored in submission folder`,
                margin + 4,
                y + 7.5,
                { maxWidth: contentWidth - 8 },
              );
              y += 15;
            }
          }
        }
        continue;
      }

      // Handle Video Field
      if (field.type === "video") {
        const videoList: any[] = Array.isArray(val) ? val : val ? [val] : [];
        const labelText = field.required ? `${field.label} *` : field.label;

        checkPageBreak(videoList.length > 0 ? 26 : 16);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(labelText, margin, y + 4);
        y += 7;

        if (videoList.length === 0) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text("[No video attached]", margin, y + 2);
          y += 8;
        } else {
          for (let vi = 0; vi < videoList.length; vi++) {
            const v = videoList[vi];
            const videoName = v.name || v.filename || `Video ${vi + 1}`;
            const videoSize = v.size ? formatBytes(v.size) : "Unknown size";
            const videoPath =
              v.path ||
              (submission.instanceFolderPath
                ? `${submission.instanceFolderPath}/${v.filename || videoName}`
                : v.filename || videoName);

            checkPageBreak(22);
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(203, 213, 225);
            doc.roundedRect(margin, y, contentWidth, 18, 1.5, 1.5, "FD");

            // Blue accent indicator
            doc.setFillColor(59, 130, 246);
            doc.rect(margin, y, 2.5, 18, "F");

            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(15, 23, 42);
            doc.text(`[VIDEO] ${videoName} (${videoSize})`, margin + 6, y + 6, {
              maxWidth: contentWidth - 10,
            });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(7.5);
            doc.setTextColor(71, 85, 105);
            doc.text(`Path on Share: /${videoPath}`, margin + 6, y + 11, {
              maxWidth: contentWidth - 10,
            });
            doc.setTextColor(100, 116, 139);
            doc.text(
              "Co-located in this submission folder. Open in app or play with media player.",
              margin + 6,
              y + 15.5,
              { maxWidth: contentWidth - 10 },
            );

            y += 22;
          }
        }
        continue;
      }
      let displayVal = "-";
      if (val !== undefined && val !== null && val !== "") {
        if (field.type === "checkbox") {
          displayVal = val === true || val === "true" ? "[X] Yes" : "[ ] No";
        } else if (field.type === "checkbox-group" && Array.isArray(val)) {
          displayVal =
            val.length > 0
              ? val
                  .map(
                    (v) =>
                      field.options?.find((o) => o.value === v)?.label ||
                      String(v),
                  )
                  .join(", ")
              : "-";
        } else if (field.type === "select" || field.type === "radio") {
          const matchedOpt = field.options?.find((o) => o.value === val);
          displayVal = matchedOpt ? matchedOpt.label : String(val);
        } else {
          displayVal = String(val);
        }
      }

      // Draw Field Row
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      const labelText = field.required ? `${field.label} *` : field.label;

      if (field.type === "textarea") {
        // Multi-line field: calculate dimensions and break page before printing label
        doc.setFont("helvetica", "normal");
        const textLines = doc.splitTextToSize(displayVal, contentWidth - 4);
        const boxHeight = Math.max(12, textLines.length * 4.5 + 4);

        checkPageBreak(boxHeight + 12);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(51, 65, 85);
        doc.text(labelText, margin, y + 4);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(15, 23, 42);
        doc.setFillColor(250, 250, 250);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(margin, y + 6, contentWidth, boxHeight, 1, 1, "FD");
        doc.text(textLines, margin + 3, y + 11);
        y += boxHeight + 9;
      } else {
        // Single-line field (Label on left, value on right or stacked)
        const rawLabelWidth = doc.getTextWidth(labelText) + 4;
        const isStacked = rawLabelWidth > 75;

        if (isStacked) {
          const valLines = doc.splitTextToSize(displayVal, contentWidth);
          const rowHeight = 5 + valLines.length * 4.5;
          checkPageBreak(rowHeight + 4);

          doc.text(labelText, margin, y + 4);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(15, 23, 42);
          doc.text(valLines, margin, y + 9);
          y += rowHeight + 3;
        } else {
          const labelWidth = Math.max(45, rawLabelWidth);
          const valueX = margin + labelWidth + 4;
          const valueWidth = contentWidth - (valueX - margin);
          const valLines = doc.splitTextToSize(displayVal, valueWidth);
          const rowHeight = Math.max(6, valLines.length * 4.5);

          checkPageBreak(rowHeight + 4);
          doc.text(labelText, margin, y + 4);

          doc.setFont("helvetica", "normal");
          doc.setTextColor(15, 23, 42);
          doc.text(valLines, valueX, y + 4);
          y += rowHeight + 2;
        }

        // Subtle divider line
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y - 1, margin + contentWidth, y - 1);
      }
    }

    y += 4;
  }

  // Add Page Footers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 12, margin + contentWidth, pageHeight - 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);

    doc.text(
      `${config.branding?.appTitle || t("header.fieldTabletApp")} | ${template.title}`,
      margin,
      pageHeight - 7,
    );

    const pageText = t("pdf.pageOf", { current: i, total: totalPages });
    doc.text(
      pageText,
      margin + contentWidth - doc.getTextWidth(pageText),
      pageHeight - 7,
    );
  }

  // Find identifier field if marked
  let identifierValue: string | undefined;
  for (const section of template.sections) {
    for (const f of section.fields) {
      if (f.isIdentifier && submission.values[f.id]) {
        identifierValue = String(submission.values[f.id]);
        break;
      }
    }
    if (identifierValue) break;
  }

  const filename = generateDatedPdfFilename(
    template.title,
    identifierValue,
    exportDate,
  );

  const dataUri = doc.output("datauristring");
  const base64 = dataUri.split(",")[1] || "";

  return {
    base64,
    filename,
  };
}
