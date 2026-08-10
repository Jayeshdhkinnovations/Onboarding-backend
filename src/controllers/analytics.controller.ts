import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Form from "../models/Form";
import Workspace from "../models/Workspace";
import ResponseModel from "../models/Response";
import {
  AnalyticsOverviewResponse,
  AnalyticsQuestionsResponse,
  AnalyticsTrendsResponse,
  AnalyticsFormsResponse,
} from "../types/analytics.types";

/**
 * Helper to resolve workspaceId from req.user
 */
const getWorkspaceId = async (req: Request): Promise<string | null> => {
  const authReq = req as any;
  if (!authReq.user) return null;

  let wsId = authReq.user.workspaceId;
  if (wsId && typeof wsId === "object" && wsId._id) {
    wsId = wsId._id.toString();
  } else if (wsId) {
    wsId = wsId.toString();
  }

  if (!wsId) {
    const workspace = await Workspace.findOne({ owner: authReq.user._id });
    if (workspace) {
      wsId = workspace._id.toString();
    }
  }

  return wsId ? wsId.toString() : null;
};

/**
 * Helper to validate form existence and workspace authorization.
 * Returns form document or sends error response (400, 404, 403).
 */
const validateFormAccess = async (
  req: Request,
  res: Response,
  formIdStr?: string
): Promise<{ form: any; userWorkspaceId: string } | null> => {
  const userWorkspaceId = await getWorkspaceId(req);
  if (!userWorkspaceId) {
    res.status(403).json({ success: false, message: "Workspace not found or access denied" });
    return null;
  }

  if (!formIdStr || !mongoose.Types.ObjectId.isValid(formIdStr)) {
    res.status(400).json({ success: false, message: "Valid formId query parameter is required" });
    return null;
  }

  const form = await Form.findById(formIdStr);
  if (!form) {
    res.status(404).json({ success: false, message: "Form not found" });
    return null;
  }

  const formWsId = form.workspaceId ? form.workspaceId.toString() : "";
  if (formWsId !== userWorkspaceId) {
    res.status(403).json({ success: false, message: "Access denied to form from another workspace" });
    return null;
  }

  return { form, userWorkspaceId };
};

/**
 * GET /api/analytics/overview?formId=&from=&to=&timezone=
 * Returns KPI totals (total, completed, in_progress, new), real completionRate, and statusDistribution using MongoDB $group
 */
export const getOverview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const formIdStr = req.query.formId as string;
    const access = await validateFormAccess(req, res, formIdStr);
    if (!access) return;

    const { form } = access;
    const fromStr = req.query.from as string;
    const toStr = req.query.to as string;
    const timezone = (req.query.timezone as string) || "UTC";

    const matchStage: any = { formId: form._id };
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (fromStr) {
      fromDate = new Date(fromStr);
      if (!isNaN(fromDate.getTime())) {
        matchStage.submittedAt = matchStage.submittedAt || {};
        matchStage.submittedAt.$gte = fromDate;
      }
    }

    if (toStr) {
      toDate = new Date(toStr);
      if (!isNaN(toDate.getTime())) {
        matchStage.submittedAt = matchStage.submittedAt || {};
        matchStage.submittedAt.$lte = toDate;
      }
    }

    // Aggregate status counts in a single MongoDB $group pipeline
    const statusStats = await ResponseModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    let total = 0;
    let completed = 0;
    let in_progress = 0;
    let newCount = 0;

    for (const item of statusStats) {
      const cnt = item.count || 0;
      total += cnt;
      if (item._id === "completed") completed = cnt;
      else if (item._id === "in_progress") in_progress = cnt;
      else if (item._id === "new") newCount = cnt;
    }

    const completionRate = total > 0 ? Number(((completed / total) * 100).toFixed(2)) : 0;

    const statusDistribution = [
      {
        status: "completed" as const,
        count: completed,
        percentage: total > 0 ? Number(((completed / total) * 100).toFixed(2)) : 0,
      },
      {
        status: "in_progress" as const,
        count: in_progress,
        percentage: total > 0 ? Number(((in_progress / total) * 100).toFixed(2)) : 0,
      },
      {
        status: "new" as const,
        count: newCount,
        percentage: total > 0 ? Number(((newCount / total) * 100).toFixed(2)) : 0,
      },
    ];

    const responseData: AnalyticsOverviewResponse = {
      success: true,
      data: {
        formId: form._id.toString(),
        total,
        completed,
        in_progress,
        new: newCount,
        completionRate,
        statusDistribution,
        dateRange: {
          from: fromDate ? fromDate.toISOString() : null,
          to: toDate ? toDate.toISOString() : null,
          timezone,
        },
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/questions?formId=&from=&to=&timezone=
 * Signed-off Contract: Returns per-question response summary & choice option distributions
 */
export const getQuestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const formIdStr = req.query.formId as string;
    const access = await validateFormAccess(req, res, formIdStr);
    if (!access) return;

    const { form } = access;
    const fromStr = req.query.from as string;
    const toStr = req.query.to as string;
    const timezone = (req.query.timezone as string) || "UTC";

    const matchStage: any = { formId: form._id };
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (fromStr) {
      fromDate = new Date(fromStr);
      if (!isNaN(fromDate.getTime())) {
        matchStage.submittedAt = matchStage.submittedAt || {};
        matchStage.submittedAt.$gte = fromDate;
      }
    }

    if (toStr) {
      toDate = new Date(toStr);
      if (!isNaN(toDate.getTime())) {
        matchStage.submittedAt = matchStage.submittedAt || {};
        matchStage.submittedAt.$lte = toDate;
      }
    }

    const responses = await ResponseModel.find(matchStage);
    const totalResponses = responses.length;

    const fields = form.fields || [];
    const questionsAnalytics = fields.map((field: any) => {
      const fieldId = field.fieldId || field.id || field._id?.toString();
      const label = field.label || "Untitled Field";
      const type = field.type || "text";

      let totalAnswered = 0;
      const optionCountMap = new Map<string, number>();
      const sampleAnswers: string[] = [];

      for (const r of responses) {
        const val = r.answers ? r.answers[fieldId] : undefined;
        if (val !== undefined && val !== null && val !== "") {
          totalAnswered++;
          if (Array.isArray(val)) {
            for (const item of val) {
              const strVal = String(item).trim();
              if (strVal) {
                optionCountMap.set(strVal, (optionCountMap.get(strVal) || 0) + 1);
              }
            }
          } else if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
            const strVal = String(val).trim();
            if (strVal) {
              optionCountMap.set(strVal, (optionCountMap.get(strVal) || 0) + 1);
              if (sampleAnswers.length < 5) {
                sampleAnswers.push(strVal);
              }
            }
          }
        }
      }

      const responseRate = totalResponses > 0 ? Number(((totalAnswered / totalResponses) * 100).toFixed(2)) : 0;

      const summary: any = {};
      if (["dropdown", "multiple_choice", "checkbox"].includes(type) || field.options?.length) {
        const optionsList = field.options || [];
        const optionSummaries = optionsList.map((opt: any) => {
          const optLabel = typeof opt === "string" ? opt : opt.label || opt.value || "";
          const cnt = optionCountMap.get(optLabel) || 0;
          const percentage = totalAnswered > 0 ? Number(((cnt / totalAnswered) * 100).toFixed(2)) : 0;
          return {
            label: optLabel,
            count: cnt,
            percentage,
          };
        });
        summary.options = optionSummaries;
      } else {
        summary.text = { sampleAnswers };
      }

      return {
        fieldId,
        label,
        type,
        totalAnswered,
        responseRate,
        summary,
      };
    });

    const responseData: AnalyticsQuestionsResponse = {
      success: true,
      data: {
        formId: form._id.toString(),
        totalResponses,
        questions: questionsAnalytics,
        dateRange: {
          from: fromDate ? fromDate.toISOString() : null,
          to: toDate ? toDate.toISOString() : null,
          timezone,
        },
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/trends?formId=&from=&to=&timezone=
 * Returns date-series trend points (total + completed) using MongoDB $group pipeline
 */
export const getTrends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const formIdStr = req.query.formId as string;
    const access = await validateFormAccess(req, res, formIdStr);
    if (!access) return;

    const { form } = access;
    const fromStr = req.query.from as string;
    const toStr = req.query.to as string;
    const interval = (req.query.interval as "day" | "week" | "month") || "day";
    const timezone = (req.query.timezone as string) || "UTC";

    const matchStage: any = { formId: form._id };
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (fromStr) {
      fromDate = new Date(fromStr);
      if (!isNaN(fromDate.getTime())) {
        matchStage.submittedAt = matchStage.submittedAt || {};
        matchStage.submittedAt.$gte = fromDate;
      }
    }

    if (toStr) {
      toDate = new Date(toStr);
      if (!isNaN(toDate.getTime())) {
        matchStage.submittedAt = matchStage.submittedAt || {};
        matchStage.submittedAt.$lte = toDate;
      }
    }

    let dateFormat = "%Y-%m-%d";
    if (interval === "month") {
      dateFormat = "%Y-%m";
    }

    const trendGroup = await ResponseModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$submittedAt", timezone } },
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const points = trendGroup.map((item) => ({
      date: item._id || "unknown",
      total: item.total,
      completed: item.completed,
    }));

    const responseData: AnalyticsTrendsResponse = {
      success: true,
      data: {
        formId: form._id.toString(),
        interval,
        points,
        dateRange: {
          from: fromDate ? fromDate.toISOString() : null,
          to: toDate ? toDate.toISOString() : null,
          timezone,
        },
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/analytics/forms
 * Returns per-form breakdown for the workspace
 */
export const getForms = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userWorkspaceId = await getWorkspaceId(req);
    if (!userWorkspaceId) {
      res.status(403).json({ success: false, message: "Workspace not found or access denied" });
      return;
    }

    const forms = await Form.find({ workspaceId: userWorkspaceId }).sort({ createdAt: -1 });
    const formIds = forms.map((f) => f._id);

    const statsGroup = await ResponseModel.aggregate([
      { $match: { formId: { $in: formIds } } },
      {
        $group: {
          _id: "$formId",
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const statsMap = new Map(statsGroup.map((s) => [s._id.toString(), s]));

    let overallTotalResponses = 0;
    const formsAnalytics = forms.map((form) => {
      const fId = form._id.toString();
      const st = statsMap.get(fId) || { total: 0, completed: 0 };
      overallTotalResponses += st.total;
      const completionRate = st.total > 0 ? Number(((st.completed / st.total) * 100).toFixed(2)) : 0;
      return {
        formId: fId,
        title: form.title,
        status: form.status,
        totalResponses: st.total,
        completedResponses: st.completed,
        completionRate,
        updatedAt: form.updatedAt,
      };
    });

    const responseData: AnalyticsFormsResponse = {
      success: true,
      data: {
        totalForms: forms.length,
        publishedForms: forms.filter((f) => f.status === "published").length,
        totalResponses: overallTotalResponses,
        forms: formsAnalytics,
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
};
