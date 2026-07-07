import Form, { IForm } from "../models/Form";

export class FormRepository {
  async create(workspaceId: string, data: Partial<IForm>): Promise<IForm> {
    return await Form.create({ ...data, workspaceId });
  }

  async findById(id: string, workspaceId?: string): Promise<IForm | null> {
    const query: any = { _id: id };
    if (workspaceId) {
      query.workspaceId = workspaceId;
    }
    return await Form.findOne(query);
  }

  async findOne(query: any, workspaceId?: string): Promise<IForm | null> {
    const finalQuery = { ...query };
    if (workspaceId) {
      finalQuery.workspaceId = workspaceId;
    }
    return await Form.findOne(finalQuery);
  }

  async findWithPagination(
    query: any,
    skip: number,
    limit: number,
    workspaceId?: string
  ): Promise<IForm[]> {
    const finalQuery = { ...query };
    if (workspaceId) {
      finalQuery.workspaceId = workspaceId;
    }
    return await Form.find(finalQuery).sort({ createdAt: -1 }).skip(skip).limit(limit);
  }

  async count(query: any, workspaceId?: string): Promise<number> {
    const finalQuery = { ...query };
    if (workspaceId) {
      finalQuery.workspaceId = workspaceId;
    }
    return await Form.countDocuments(finalQuery);
  }

  async update(id: string, workspaceId: string, data: Partial<IForm>): Promise<IForm | null> {
    return await Form.findOneAndUpdate({ _id: id, workspaceId }, data, { new: true });
  }

  async delete(id: string, workspaceId: string): Promise<IForm | null> {
    return await Form.findOneAndDelete({ _id: id, workspaceId });
  }
}
