import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import ReportModel, { IReport } from "../models/Report";
import Form from "../models/Form";
import ResponseModel from "../models/Response";

const UPLOADS_REPORTS_DIR = path.join(process.cwd(), "uploads", "reports");

const ensureReportsDir = (): void => {
  if (!fs.existsSync(UPLOADS_REPORTS_DIR)) {
    fs.mkdirSync(UPLOADS_REPORTS_DIR, { recursive: true });
  }
};

/**
 * Escapes special characters for CSV values & prevents formula injection.
 */
const escapeCsv = (val: any): string => {
  if (val === null || val === undefined) return '""';
  if (Array.isArray(val)) {
    val = val.join("; ");
  } else if (typeof val === "object") {
    val = JSON.stringify(val);
  }
  let str = String(val);
  
  // Prevent CSV formula injection for spreadsheet software
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
};

/**
 * Background Asynchronous Generator for CSV and PDF Reports.
 */
export const generateReportAsync = async (reportId: string): Promise<void> => {
  try {
    ensureReportsDir();

    const report = await ReportModel.findById(reportId);
    if (!report || report.status === "completed" || report.status === "failed") {
      return;
    }

    report.status = "processing";
    await report.save();

    // Resolve workspace forms
    const forms = await Form.find({ workspaceId: report.workspaceId });
    const formMap = new Map(forms.map((f) => [f._id.toString(), f]));
    const workspaceFormIds = forms.map((f) => f._id);

    const query: any = { formId: { $in: workspaceFormIds } };
    const filters = report.filters || {};

    if (filters.formId && mongoose.Types.ObjectId.isValid(filters.formId)) {
      if (workspaceFormIds.some((id) => id.toString() === filters.formId)) {
        query.formId = new mongoose.Types.ObjectId(filters.formId);
      }
    }

    if (filters.status && ["new", "in_progress", "completed"].includes(filters.status)) {
      query.status = filters.status;
    }

    // Handle date range filters safely without creating empty object queries
    if ((filters.from && filters.from !== "all") || (filters.to && filters.to !== "all")) {
      const submittedAtQuery: any = {};
      if (filters.from && filters.from !== "all") {
        const fromDate = new Date(filters.from);
        if (!isNaN(fromDate.getTime())) submittedAtQuery.$gte = fromDate;
      }
      if (filters.to && filters.to !== "all") {
        const toDate = new Date(filters.to);
        if (!isNaN(toDate.getTime())) submittedAtQuery.$lte = toDate;
      }
      if (Object.keys(submittedAtQuery).length > 0) {
        query.submittedAt = submittedAtQuery;
      }
    }

    const filename = `${report._id.toString()}.${report.format}`;
    const targetFilePath = path.join(UPLOADS_REPORTS_DIR, filename);

    if (report.format === "csv") {
      const writeStream = fs.createWriteStream(targetFilePath, { encoding: "utf8" });

      // CSV Header
      writeStream.write(`Response ID,Form ID,Form Title,Status,Submitted At,Answers\n`);

      // Stream responses to prevent in-memory spikes
      const cursor = ResponseModel.find(query).sort({ submittedAt: -1 }).cursor();
      for (let r = await cursor.next(); r != null; r = await cursor.next()) {
        const formTitle = formMap.get(r.formId.toString())?.title || "Form Response";
        const answersFormatted = escapeCsv(r.answers);
        const line = `${escapeCsv(r._id.toString())},${escapeCsv(r.formId.toString())},${escapeCsv(
          formTitle
        )},${escapeCsv(r.status || "new")},${escapeCsv(
          r.submittedAt ? r.submittedAt.toISOString() : r.createdAt.toISOString()
        )},${answersFormatted}\n`;
        writeStream.write(line);
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.end();
        writeStream.on("finish", () => resolve());
        writeStream.on("error", (err) => reject(err));
      });
    } else if (report.format === "pdf") {
      // PDF generation using pure JS pdfkit engine (no external binary or Puppeteer dependency required)
      const responses = await ResponseModel.find(query).sort({ submittedAt: -1 }).limit(500);
      const totalCount = responses.length;
      const completedCount = responses.filter((r) => r.status === "completed").length;

      await new Promise<void>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        const writeStream = fs.createWriteStream(targetFilePath);

        writeStream.on("finish", () => resolve());
        writeStream.on("error", (err) => reject(err));
        doc.on("error", (err) => reject(err));

        doc.pipe(writeStream);

        // Header Title
        doc.fillColor("#1E40AF").fontSize(20).text("Beginso Workspace Analytics Report", { align: "left" });
        doc.moveDown(0.5);
        doc.fillColor("#4B5563").fontSize(10).text(`Generated At: ${new Date().toUTCString()}`);
        doc.text(`Total Responses in Range: ${totalCount}`);
        doc.text(`Completed Responses: ${completedCount}`);
        doc.moveDown(1);

        // Horizontal Line
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#E5E7EB").stroke();
        doc.moveDown(1);

        // Table Header
        doc.fillColor("#1E40AF").fontSize(11).text("Response Records Summary:", { underline: true });
        doc.moveDown(0.5);

        if (responses.length === 0) {
          doc.fillColor("#6B7280").fontSize(10).text("No responses found for the selected filter range.");
        } else {
          for (const r of responses) {
            const title = formMap.get(r.formId.toString())?.title || "Form Response";
            const dateStr = r.submittedAt ? r.submittedAt.toISOString().slice(0, 10) : r.createdAt.toISOString().slice(0, 10);
            doc.fillColor("#111827").fontSize(9).text(`• ID: ${r._id.toString()}  |  Form: ${title}  |  Status: ${r.status || "new"}  |  Date: ${dateStr}`);
            doc.moveDown(0.3);
          }
        }

        doc.end();
      });
    }

    if (!fs.existsSync(targetFilePath)) {
      throw new Error(`Report file failed to generate at path ${targetFilePath}`);
    }

    const stats = fs.statSync(targetFilePath);
    report.filePath = targetFilePath;
    report.fileSize = stats.size;
    report.status = "completed";
    report.errorMessage = undefined;
    await report.save();
  } catch (err: any) {
    console.error("Report generation error:", err);
    try {
      const report = await ReportModel.findById(reportId);
      if (report) {
        report.status = "failed";
        report.errorMessage = err?.message || "Failed to generate report due to an internal processing error. Please try again.";
        await report.save();
      }
    } catch (saveErr) {
      // Ignored
    }
  }
};
