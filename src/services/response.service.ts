import { ResponseRepository } from "../repositories/response.repository";
import { FormRepository } from "../repositories/form.repository";
import { PaginatedResponsesResult, IResponse } from "../types/response.types";
import mongoose from "mongoose";

export class ResponseService {
  private responseRepository = new ResponseRepository();
  private formRepository = new FormRepository();

  async getResponses(params: {
    workspaceId: string;
    formId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponsesResult> {
    const { workspaceId, formId, status, search } = params;

    let page = Number(params.page) || 1;
    if (page < 1) page = 1;

    let limit = Number(params.limit) || 10;
    if (limit < 1) limit = 10;
    if (limit > 50) limit = 50; // Cap at 50 per page max

    const mongoQuery: any = {};

    // Scope to workspaceId via form lookup
    if (formId) {
      if (!mongoose.Types.ObjectId.isValid(formId)) {
        const err: any = new Error("Form not found");
        err.statusCode = 404;
        throw err;
      }

      const form = await this.formRepository.findById(formId);
      if (!form) {
        const err: any = new Error("Form not found");
        err.statusCode = 404;
        throw err;
      }

      if (form.workspaceId.toString() !== workspaceId) {
        const err: any = new Error("Forbidden: You do not own this form's workspace");
        err.statusCode = 403;
        throw err;
      }

      mongoQuery.formId = form._id;
    } else {
      // Find all forms in workspace
      const forms = await this.formRepository.findWithPagination(
        { workspaceId },
        0,
        1000,
        workspaceId
      );
      const formIds = forms.map((f) => f._id);
      mongoQuery.formId = { $in: formIds };
    }

    // Status filter
    if (status) {
      mongoQuery.status = status;
    }

    // Search filter against answers content
    if (search && search.trim() !== "") {
      const escapedSearch = search.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&");
      const searchRegex = new RegExp(escapedSearch, "i");
      mongoQuery.$or = [
        { answers: searchRegex },
        { "answers.value": searchRegex },
        { "answers.fileName": searchRegex },
        {
          $expr: {
            $regexMatch: {
              input: {
                $convert: {
                  input: "$answers",
                  to: "string",
                  onError: "",
                  onNull: "",
                },
              },
              regex: escapedSearch,
              options: "i",
            },
          },
        },
        {
          $expr: {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: {
                      $cond: [
                        { $eq: [{ $type: "$answers" }, "object"] },
                        { $objectToArray: "$answers" },
                        [],
                      ],
                    },
                    as: "item",
                    cond: {
                      $regexMatch: {
                        input: {
                          $convert: {
                            input: "$$item.v",
                            to: "string",
                            onError: "",
                            onNull: "",
                          },
                        },
                        regex: escapedSearch,
                        options: "i",
                      },
                    },
                  },
                },
              },
              0,
            ],
          },
        },
      ];
    }

    const skip = (page - 1) * limit;

    const [responses, total] = await Promise.all([
      this.responseRepository.findWithPagination(mongoQuery, skip, limit),
      this.responseRepository.count(mongoQuery),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Format output matching IResponse interface
    const formattedData: IResponse[] = responses.map((r: any) => ({
      _id: r._id.toString(),
      formId: r.formId.toString(),
      answers: r.answers,
      status: r.status || "completed",
      submittedAt: r.submittedAt,
      ipHash: r.ipHash,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return {
      data: formattedData,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
