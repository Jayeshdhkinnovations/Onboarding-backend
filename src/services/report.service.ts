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
    let fromDateObj: Date | null = null;
    let toDateObj: Date | null = null;

    if ((filters.from && filters.from !== "all") || (filters.to && filters.to !== "all")) {
      const submittedAtQuery: any = {};
      if (filters.from && filters.from !== "all") {
        fromDateObj = new Date(filters.from);
        if (!isNaN(fromDateObj.getTime())) submittedAtQuery.$gte = fromDateObj;
      }
      if (filters.to && filters.to !== "all") {
        toDateObj = new Date(filters.to);
        if (!isNaN(toDateObj.getTime())) submittedAtQuery.$lte = toDateObj;
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
      // PDF generation matching the Analytics Dashboard layout (KPI cards, Trend chart, Status breakdown, Appendix)
      const responses = await ResponseModel.find(query).sort({ submittedAt: -1 }).limit(500);
      const totalCount = responses.length;
      const completedCount = responses.filter((r) => r.status === "completed").length;
      const inProgressCount = responses.filter((r) => r.status === "in_progress").length;
      const newCount = responses.filter((r) => r.status === "new" || !r.status).length;

      // Determine scoped form title
      let scopedTitle = "All Workspace Forms";
      if (filters.formId && formMap.has(filters.formId)) {
        scopedTitle = formMap.get(filters.formId)!.title;
      }

      // Format date range text
      const rangeText = fromDateObj && toDateObj
        ? `${fromDateObj.toISOString().slice(0, 10)} to ${toDateObj.toISOString().slice(0, 10)}`
        : "All Time";

      await new Promise<void>((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
        const writeStream = fs.createWriteStream(targetFilePath);

        writeStream.on("finish", () => resolve());
        writeStream.on("error", (err) => reject(err));
        doc.on("error", (err) => reject(err));

        doc.pipe(writeStream);

        // --- 1. HEADER SECTION ---
        doc.fillColor("#1D4ED8").fontSize(20).font("Helvetica-Bold").text("BEGINSO", 40, 40);
        doc.fillColor("#0F172A").fontSize(16).font("Helvetica-Bold").text("Analytics Report", 40, 68);
        doc.fillColor("#475569").fontSize(11).font("Helvetica").text(`Form: ${scopedTitle}`, 40, 90);
        
        doc.fillColor("#64748B").fontSize(9).font("Helvetica");
        doc.text(`Report Period: ${rangeText}`, 350, 40, { align: "right" });
        doc.text(`Generated: ${new Date().toUTCString()}`, 350, 54, { align: "right" });

        // Divider
        doc.moveTo(40, 112).lineTo(555, 112).strokeColor("#E2E8F0").lineWidth(1).stroke();

        // --- 2. SUMMARY ROW (4 EQUAL-WIDTH KPI CARDS) ---
        const startY = 125;
        const cardWidth = 120;
        const cardHeight = 55;
        const gap = 12;

        const kpis = [
          { label: "TOTAL RESPONSES", count: totalCount, color: "#0F172A" },
          { label: "COMPLETED", count: completedCount, color: "#22C55E" },
          { label: "IN PROGRESS", count: inProgressCount, color: "#EAB308" },
          { label: "NEW", count: newCount, color: "#3B82F6" },
        ];

        kpis.forEach((kpi, idx) => {
          const x = 40 + idx * (cardWidth + gap);
          // Card background & border
          doc.roundedRect(x, startY, cardWidth, cardHeight, 6).fillAndStroke("#F8FAFC", "#E2E8F0");

          // Label
          doc.fillColor("#64748B").fontSize(7).font("Helvetica-Bold").text(kpi.label, x + 10, startY + 10);
          // Big Number
          doc.fillColor(kpi.color).fontSize(18).font("Helvetica-Bold").text(String(kpi.count), x + 10, startY + 24);
        });

        // --- 3. STATUS DISTRIBUTION PROGRESS BAR & LEGEND ---
        let currentY = 195;
        doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("Status Distribution", 40, currentY);
        currentY += 18;

        const totalForPct = totalCount > 0 ? totalCount : 1;
        const completedPct = Math.round((completedCount / totalForPct) * 100);
        const inProgressPct = Math.round((inProgressCount / totalForPct) * 100);
        const newPct = Math.max(0, 100 - completedPct - inProgressPct);

        // Stacked Progress Bar
        const barX = 40;
        const barW = 515;
        const barH = 14;

        doc.roundedRect(barX, currentY, barW, barH, 4).fill("#E2E8F0"); // base

        let currX = barX;
        if (totalCount > 0) {
          const wCompleted = (completedCount / totalCount) * barW;
          const wInProgress = (inProgressCount / totalCount) * barW;
          const wNew = (newCount / totalCount) * barW;

          if (wCompleted > 0) {
            doc.rect(currX, currentY, wCompleted, barH).fill("#22C55E");
            currX += wCompleted;
          }
          if (wInProgress > 0) {
            doc.rect(currX, currentY, wInProgress, barH).fill("#EAB308");
            currX += wInProgress;
          }
          if (wNew > 0) {
            doc.rect(currX, currentY, wNew, barH).fill("#3B82F6");
          }
        }

        currentY += 22;

        // Legend Items
        doc.fillColor("#15803D").fontSize(9).font("Helvetica-Bold").text(`● Completed: ${completedCount} (${completedPct}%)`, 40, currentY);
        doc.fillColor("#A16207").fontSize(9).font("Helvetica-Bold").text(`● In Progress: ${inProgressCount} (${inProgressPct}%)`, 200, currentY);
        doc.fillColor("#1D4ED8").fontSize(9).font("Helvetica-Bold").text(`● New: ${newCount} (${newPct}%)`, 380, currentY);

        // --- 4. RESPONSE TREND SPARKLINE / VOLUME CHART ---
        currentY += 26;
        doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("Response Volume Trend", 40, currentY);
        currentY += 18;

        // Group responses by day for chart
        const dayCounts = new Map<string, number>();
        responses.forEach((r) => {
          const dt = r.submittedAt || r.createdAt;
          const dKey = dt ? dt.toISOString().slice(5, 10) : "N/A";
          dayCounts.set(dKey, (dayCounts.get(dKey) || 0) + 1);
        });

        const trendPoints = Array.from(dayCounts.entries()).slice(-10); // last 10 dates
        const maxVal = Math.max(1, ...trendPoints.map((p) => p[1]));

        const chartX = 40;
        const chartY = currentY;
        const chartW = 515;
        const chartH = 65;

        // Chart box background
        doc.roundedRect(chartX, chartY, chartW, chartH, 6).fillAndStroke("#F8FAFC", "#E2E8F0");

        if (trendPoints.length > 0) {
          const stepW = chartW / (trendPoints.length || 1);
          trendPoints.forEach((pt, idx) => {
            const bX = chartX + idx * stepW + stepW * 0.2;
            const bW = Math.max(8, stepW * 0.6);
            const bH = (pt[1] / maxVal) * (chartH - 25);
            const bY = chartY + chartH - 15 - bH;

            // Bar
            doc.rect(bX, bY, bW, bH).fill("#1D4ED8");
            // Label date below
            doc.fillColor("#64748B").fontSize(7).font("Helvetica").text(pt[0], bX - 4, chartY + chartH - 12, { width: bW + 8, align: "center" });
            // Count above bar
            doc.fillColor("#0F172A").fontSize(7).font("Helvetica-Bold").text(String(pt[1]), bX - 4, bY - 9, { width: bW + 8, align: "center" });
          });
        }

        currentY = chartY + chartH + 20;

        // --- 5. RESPONSE RECORDS APPENDIX TABLE ---
        doc.fillColor("#0F172A").fontSize(12).font("Helvetica-Bold").text("Response Records Appendix", 40, currentY);
        currentY += 18;

        // Table Header
        const tX = 40;
        const colWidths = [160, 160, 90, 105];
        
        doc.rect(tX, currentY, 515, 18).fill("#1E40AF");
        doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold");
        doc.text("RESPONSE ID", tX + 8, currentY + 5);
        doc.text("FORM TITLE", tX + 8 + colWidths[0], currentY + 5);
        doc.text("STATUS", tX + 8 + colWidths[0] + colWidths[1], currentY + 5);
        doc.text("SUBMITTED AT", tX + 8 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 5);

        currentY += 18;

        if (responses.length === 0) {
          doc.fillColor("#64748B").fontSize(9).font("Helvetica").text("No response records match the criteria.", tX + 8, currentY + 8);
        } else {
          // Render rows
          responses.forEach((r, idx) => {
            if (currentY > 740) {
              doc.addPage();
              currentY = 40;
              // Repeat Table Header on new page
              doc.rect(tX, currentY, 515, 18).fill("#1E40AF");
              doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold");
              doc.text("RESPONSE ID", tX + 8, currentY + 5);
              doc.text("FORM TITLE", tX + 8 + colWidths[0], currentY + 5);
              doc.text("STATUS", tX + 8 + colWidths[0] + colWidths[1], currentY + 5);
              doc.text("SUBMITTED AT", tX + 8 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 5);
              currentY += 18;
            }

            const bg = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
            doc.rect(tX, currentY, 515, 16).fill(bg);

            const formTitle = formMap.get(r.formId.toString())?.title || scopedTitle;
            const dateStr = (r.submittedAt || r.createdAt).toISOString().slice(0, 10);
            const statusStr = r.status || "new";
            const statusColor = statusStr === "completed" ? "#15803D" : statusStr === "in_progress" ? "#A16207" : "#1D4ED8";

            doc.fillColor("#334155").fontSize(8).font("Helvetica");
            doc.text(r._id.toString(), tX + 8, currentY + 4, { width: colWidths[0] - 10 });
            doc.text(formTitle, tX + 8 + colWidths[0], currentY + 4, { width: colWidths[1] - 10 });
            doc.fillColor(statusColor).font("Helvetica-Bold").text(statusStr.toUpperCase(), tX + 8 + colWidths[0] + colWidths[1], currentY + 4);
            doc.fillColor("#334155").font("Helvetica").text(dateStr, tX + 8 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 4);

            currentY += 16;
          });
        }

        // --- 6. FOOTER ON EVERY PAGE ---
        const rangePages = doc.bufferedPageRange();
        for (let i = rangePages.start; i < rangePages.start + rangePages.count; i++) {
          doc.switchToPage(i);
          const pageNum = i + 1;
          const totalPages = rangePages.count;

          doc.moveTo(40, 800).lineTo(555, 800).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
          doc.fillColor("#94A3B8").fontSize(8).font("Helvetica");
          doc.text("Beginso · Analytics Report", 40, 808);
          doc.text(scopedTitle, 200, 808, { width: 195, align: "center" });
          doc.text(`Page ${pageNum} of ${totalPages}`, 400, 808, { align: "right" });
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
