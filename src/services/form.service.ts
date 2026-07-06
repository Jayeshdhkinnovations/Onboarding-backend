import { FormRepository } from "../repositories/form.repository";
import { IForm } from "../models/Form";
import ResponseModel from "../models/Response";

export class FormService {
  private formRepository = new FormRepository();

  async createForm(workspaceId: string, formDetails: Partial<IForm>): Promise<IForm> {
    return await this.formRepository.create({
      ...formDetails,
      workspaceId: workspaceId as any,
    });
  }

  async getFormById(formId: string, workspaceId: string): Promise<IForm> {
    const form = await this.formRepository.findById(formId);
    if (!form) {
      const err = new Error("Form not found");
      (err as any).statusCode = 404;
      throw err;
    }
    if (form.workspaceId.toString() !== workspaceId.toString()) {
      const err = new Error("Forbidden: You do not own this form's workspace");
      (err as any).statusCode = 403;
      throw err;
    }
    return form;
  }

  async listForms(
    workspaceId: string,
    options: {
      search?: string;
      status?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 10;
    const skip = (page - 1) * limit;

    const query: any = { workspaceId };

    if (options.status) {
      query.status = options.status;
    }

    if (options.search) {
      query.title = { $regex: options.search, $options: "i" };
    }

    const [forms, total] = await Promise.all([
      this.formRepository.findWithPagination(query, skip, limit),
      this.formRepository.count(query),
    ]);

    const pages = Math.ceil(total / limit);

    return {
      forms,
      total,
      page,
      limit,
      pages,
    };
  }

  async updateForm(
    formId: string,
    workspaceId: string,
    updateDetails: Partial<IForm>
  ): Promise<IForm> {
    await this.getFormById(formId, workspaceId); // enforces workspace scoping
    const updated = await this.formRepository.update(formId, updateDetails);
    if (!updated) {
      const err = new Error("Form not found for update");
      (err as any).statusCode = 404;
      throw err;
    }
    return updated;
  }

  async deleteForm(formId: string, workspaceId: string): Promise<void> {
    await this.getFormById(formId, workspaceId); // enforces workspace scoping
    
    // 1. Delete associated responses
    await ResponseModel.deleteMany({ formId });

    // 2. Delete the form
    await this.formRepository.delete(formId);
  }

  async submitForm(formId: string, answers: Record<string, any>) {
    const form = await this.formRepository.findById(formId);
    if (!form) {
      const err = new Error("Form not found");
      (err as any).statusCode = 404;
      throw err;
    }

    // Dynamic validation logic against form fields
    for (const field of form.fields) {
      const value = answers[field.label];
      if (field.required && (value === undefined || value === null || value === "")) {
        const err = new Error(`Field "${field.label}" is required.`);
        (err as any).statusCode = 400;
        throw err;
      }
      if (value && field.type === "dropdown" && field.options && field.options.length > 0) {
        if (!field.options.includes(value)) {
          const err = new Error(`Value "${value}" is not a valid option for field "${field.label}". Valid options: ${field.options.join(", ")}`);
          (err as any).statusCode = 400;
          throw err;
        }
      }
    }

    return await ResponseModel.create({
      formId,
      answers,
    });
  }

  async getSubmissions(formId: string, workspaceId: string) {
    await this.getFormById(formId, workspaceId); // checks workspace ownership
    return await ResponseModel.find({ formId });
  }
}
