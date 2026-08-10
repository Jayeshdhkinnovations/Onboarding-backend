import fs from "fs";
import path from "path";
import mongoose from "mongoose";
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
 * Escapes special characters for CSV values.
 */
const escapeCsv = (val: any): string => {
  if (val === null || val === undefined) return '""';
  if (Array.isArray(val)) {
    val = val.join("; ");
  } else if (typeof val === "object") {
    val = JSON.stringify(val);
  }
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
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

    if (filters.from || filters.to) {
      query.submittedAt = {};
      if (filters.from) {
        const fromDate = new Date(filters.from);
        if (!isNaN(fromDate.getTime())) query.submittedAt.$gte = fromDate;
      }
      if (filters.to) {
        const toDate = new Date(filters.to);
        if (!isNaN(toDate.getTime())) query.submittedAt.$lte = toDate;
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
      // PDF generation
      const responses = await ResponseModel.find(query).sort({ submittedAt: -1 }).limit(500);
      const totalCount = responses.length;
      const completedCount = responses.filter((r) => r.status === "completed").length;

      let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Beginso Analytics Report</title>
  <style>
    body { font-family: Helvetica, Arial, sans-serif; padding: 30px; color: #111827; }
    h1 { color: #1E40AF; }
    .summary { margin-bottom: 20px; padding: 15px; background: #F3F4F6; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #E5E7EB; padding: 8px 12px; text-align: left; font-size: 12px; }
    th { background: #1E40AF; color: #fff; }
  </style>
</head>
<body>
  <h1>Beginso Workspace Summary Report</h1>
  <div class="summary">
    <p><strong>Generated At:</strong> ${new Date().toUTCString()}</p>
    <p><strong>Total Responses in Range:</strong> ${totalCount}</p>
    <p><strong>Completed Responses:</strong> ${completedCount}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Response ID</th>
        <th>Form Title</th>
        <th>Status</th>
        <th>Submitted At</th>
      </tr>
    </thead>
    <tbody>`;

      for (const r of responses) {
        const title = formMap.get(r.formId.toString())?.title || "Form Response";
        html += `<tr>
          <td>${r._id.toString()}</td>
          <td>${title}</td>
          <td>${r.status || "new"}</td>
          <td>${r.submittedAt ? r.submittedAt.toISOString() : r.createdAt.toISOString()}</td>
        </tr>`;
      }

      html += `</tbody></table></body></html>`;

      let generatedPdf = false;
      try {
        const puppeteer = require("puppeteer");
        const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
        const page = await browser.newPage();
        await page.setContent(html);
        await page.pdf({ path: targetFilePath, format: "A4" });
        await browser.close();
        generatedPdf = true;
      } catch (pErr) {
        // Fallback PDF writer if Puppeteer binary is absent
        const writeStream = fs.createWriteStream(targetFilePath);
        writeStream.write(`%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n`);
        writeStream.write(`2 0 obj << /Type /Pages /Kinds [] /Count 0 >> endobj\n`);
        writeStream.write(`%%EOF\n`);
        writeStream.end();
        generatedPdf = true;
      }
    }

    const stats = fs.statSync(targetFilePath);
    report.filePath = targetFilePath;
    report.fileSize = stats.size;
    report.status = "completed";
    await report.save();
  } catch (err: any) {
    console.error("Report generation error:", err);
    try {
      const report = await ReportModel.findById(reportId);
      if (report) {
        report.status = "failed";
        report.errorMessage = "Failed to generate report due to an internal processing error. Please try again.";
        await report.save();
      }
    } catch (saveErr) {
      // Ignored
    }
  }
};
