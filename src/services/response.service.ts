import { ResponseRepository } from "../repositories/response.repository";
import { FormRepository } from "../repositories/form.repository";
import Upload from "../models/Upload";
import { getUploadDir, deleteFileAndEmptyParents } from "../controllers/upload.controller";
import { PaginatedResponsesResult, IResponse, IResponseFile } from "../types/response.types";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

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
      const searchRegex = new RegExp(search.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&"), "i");
      const candidates = await this.responseRepository.findWithPagination(mongoQuery, 0, 10000);
      const matchingIds = candidates
        .filter((r) => {
          const str = JSON.stringify(r.answers || {});
          return searchRegex.test(str);
        })
        .map((r) => r._id);

      mongoQuery._id = { $in: matchingIds };
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
      status: r.status || "new",
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

  async getResponseDetail(
    workspaceId: string,
    responseId: string,
    host: string,
    protocol: string
  ): Promise<IResponse> {
    const response = await this.responseRepository.findById(responseId);
    if (!response) {
      const err: any = new Error("Response not found");
      err.statusCode = 404;
      throw err;
    }

    const form = await this.formRepository.findById(response.formId.toString());
    if (!form || form.workspaceId.toString() !== workspaceId) {
      const err: any = new Error("Forbidden: You do not own this response's workspace");
      err.statusCode = 403;
      throw err;
    }

    // Join response_files metadata from Upload collection
    const uploadDocs = await Upload.find({
      path: { $regex: responseId },
    });

    const responseFiles: IResponseFile[] = uploadDocs.map((up) => ({
      id: up._id.toString(),
      name: up.name,
      size: up.size,
      type: up.type,
      url: `${protocol}://${host}/api/upload/file/${up.path.replace(/\\/g, "/")}`,
      uploadTime: up.uploadTime,
    }));

    return {
      _id: response._id.toString(),
      formId: response.formId.toString(),
      answers: response.answers,
      status: response.status || "new",
      submittedAt: response.submittedAt,
      ipHash: response.ipHash,
      response_files: responseFiles,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  }

  async updateResponseStatus(
    workspaceId: string,
    responseId: string,
    status: "new" | "in_progress" | "completed"
  ): Promise<IResponse> {
    const response = await this.responseRepository.findById(responseId);
    if (!response) {
      const err: any = new Error("Response not found");
      err.statusCode = 404;
      throw err;
    }

    const form = await this.formRepository.findById(response.formId.toString());
    if (!form || form.workspaceId.toString() !== workspaceId) {
      const err: any = new Error("Forbidden: You do not own this response's workspace");
      err.statusCode = 403;
      throw err;
    }

    const updated = await this.responseRepository.updateStatus(responseId, status);
    if (!updated) {
      const err: any = new Error("Failed to update response status");
      err.statusCode = 500;
      throw err;
    }

    return {
      _id: updated._id.toString(),
      formId: updated.formId.toString(),
      answers: updated.answers,
      status: updated.status || status,
      submittedAt: updated.submittedAt,
      ipHash: updated.ipHash,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteResponse(workspaceId: string, responseId: string): Promise<boolean> {
    const response = await this.responseRepository.findById(responseId);
    if (!response) {
      const err: any = new Error("Response not found");
      err.statusCode = 404;
      throw err;
    }

    const form = await this.formRepository.findById(response.formId.toString());
    if (!form || form.workspaceId.toString() !== workspaceId) {
      const err: any = new Error("Forbidden: You do not own this response's workspace");
      err.statusCode = 403;
      throw err;
    }

    // Cascade delete response_files metadata & physical files from disk
    const uploadDocs = await Upload.find({
      path: { $regex: responseId },
    });

    const uploadDir = getUploadDir();
    for (const up of uploadDocs) {
      if (up.path) {
        const fullPath = path.isAbsolute(up.path)
          ? up.path
          : path.join(uploadDir, up.path);
        try {
          if (fs.existsSync(fullPath)) {
            await deleteFileAndEmptyParents(fullPath, uploadDir);
          }
        } catch (fileErr) {
          console.error(`Failed to delete physical file: ${fullPath}`, fileErr);
        }
      }
    }

    // Sweep response directory if present
    try {
      const responseDir = path.join(
        uploadDir,
        form.workspaceId.toString(),
        form._id.toString(),
        "responses",
        responseId
      );
      if (fs.existsSync(responseDir)) {
        fs.rmSync(responseDir, { recursive: true, force: true });
      }
    } catch (dirErr) {
      // Silently ignore directory sweep errors
    }

    await Upload.deleteMany({ path: { $regex: responseId } });
    await this.responseRepository.deleteById(responseId);

    return true;
  }

  async getResponseFileUrl(
    workspaceId: string,
    responseId: string,
    fileId: string,
    host: string,
    protocol: string
  ): Promise<{ url: string }> {
    const response = await this.responseRepository.findById(responseId);
    if (!response) {
      const err: any = new Error("Response not found");
      err.statusCode = 404;
      throw err;
    }

    const form = await this.formRepository.findById(response.formId.toString());
    if (!form || form.workspaceId.toString() !== workspaceId) {
      const err: any = new Error("Forbidden: You do not own this response's workspace");
      err.statusCode = 403;
      throw err;
    }

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      const err: any = new Error("File not found for this response");
      err.statusCode = 404;
      throw err;
    }

    const upload = await Upload.findById(fileId);
    if (!upload || !upload.path.includes(responseId)) {
      const err: any = new Error("File not found for this response");
      err.statusCode = 404;
      throw err;
    }

    const safeUrl = `${protocol}://${host}/api/upload/file/${upload.path.replace(/\\/g, "/")}`;

    return { url: safeUrl };
  }
}
