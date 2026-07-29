import User from "../models/User";
import Workspace from "../models/Workspace";
import Form from "../models/Form";
import ResponseModel from "../models/Response";
import Upload from "../models/Upload";
import { SystemLog } from "../models/SystemLog";

export class SuperAdminService {
  async getPlatformStats() {
    const activeAdmins = await User.countDocuments({ role: "admin", status: { $ne: "suspended" } });
    const suspendedAdmins = await User.countDocuments({ role: "admin", status: "suspended" });

    const totalWorkspaces = await Workspace.countDocuments();
    const totalForms = await Form.countDocuments();
    const publishedForms = await Form.countDocuments({ status: "published" });
    const totalResponses = await ResponseModel.countDocuments();

    // Cumulative storage used in bytes
    const storageUsedResult = await Upload.aggregate([
      { $group: { _id: null, total: { $sum: "$size" } } },
    ]);
    const totalStorageUsed = storageUsedResult[0]?.total || 0;

    // Submissions in last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const responsesLast24h = await ResponseModel.countDocuments({
      createdAt: { $gte: oneDayAgo },
    });

    // Recent signups (last 10 admins)
    const lastAdmins = await User.find({ role: "admin" })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("workspaceId");

    const recentSignups = lastAdmins.map((user: any) => ({
      name: user.fullName,
      email: user.email,
      workspaceName: user.workspaceId?.name || "No Workspace",
      createdAt: user.createdAt,
    }));

    return {
      stats: {
        totalAdmins: {
          active: activeAdmins,
          suspended: suspendedAdmins,
        },
        totalWorkspaces,
        totalForms,
        publishedForms,
        totalResponses,
        totalStorageUsed,
        responsesLast24h,
      },
      recentSignups,
    };
  }

  async getAbuseStats() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Top 5 rate-limited IP hashes (first 16 chars)
    const topBlockedIps = await SystemLog.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          "meta.type": "rate_limit",
        },
      },
      {
        $group: {
          _id: "$meta.ipHash",
          hits: { $sum: 1 },
        },
      },
      { $sort: { hits: -1 } },
      { $limit: 5 },
      {
        $project: {
          ipHash: { $substrCP: ["$_id", 0, 16] },
          hits: 1,
          _id: 0,
        },
      },
    ]);

    // Top 5 rate-limited slugs
    const topBlockedSlugs = await SystemLog.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          "meta.type": "rate_limit",
        },
      },
      {
        $group: {
          _id: "$meta.slug",
          hits: { $sum: 1 },
        },
      },
      { $sort: { hits: -1 } },
      { $limit: 5 },
      {
        $project: {
          slug: "$_id",
          hits: 1,
          _id: 0,
        },
      },
    ]);

    // Honeypot silent-drop count
    const honeypotDrops = await SystemLog.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
      "meta.type": "honeypot_drop",
    });

    return {
      abuse: {
        topBlockedIps,
        topBlockedSlugs,
        honeypotDrops,
      },
    };
  }

  async getLogs(filters: {
    level?: string;
    from?: string;
    to?: string;
    route?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const query: any = {};

    if (filters.level) {
      query.level = filters.level;
    }

    if (filters.route) {
      query.route = { $regex: filters.route, $options: "i" };
    }

    if (filters.search) {
      query.message = { $regex: filters.search, $options: "i" };
    }

    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) {
        query.createdAt.$gte = new Date(filters.from);
      }
      if (filters.to) {
        query.createdAt.$lte = new Date(filters.to);
      }
    }

    let page = filters.page || 1;
    let limit = filters.limit || 20;

    // Clamp limit to avoid unbounded queries
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 20;
    if (page < 1) page = 1;

    const skip = (page - 1) * limit;

    const total = await SystemLog.countDocuments(query);
    const logs = await SystemLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const isProduction = process.env.NODE_ENV === "production";
    const sanitizedLogs = logs.map((log) => {
      const logObj = log.toObject();
      if (logObj.level !== "error") {
        delete logObj.meta;
      }
      if (isProduction) {
        delete logObj.stack;
      }
      return logObj;
    });

    const pages = Math.ceil(total / limit);

    return {
      logs: sanitizedLogs,
      pagination: {
        total,
        page,
        limit,
        pages,
      },
    };
  }
}

export const superAdminService = new SuperAdminService();
