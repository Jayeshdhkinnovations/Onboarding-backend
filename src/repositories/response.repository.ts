import ResponseModel, { IResponse } from "../models/Response";

export class ResponseRepository {
  async create(data: Partial<IResponse>): Promise<IResponse> {
    return await ResponseModel.create(data);
  }

  async findById(id: string): Promise<IResponse | null> {
    return await ResponseModel.findById(id);
  }

  async findWithPagination(
    query: any,
    skip: number,
    limit: number
  ): Promise<IResponse[]> {
    return await ResponseModel.find(query)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async count(query: any): Promise<number> {
    return await ResponseModel.countDocuments(query);
  }

  async deleteMany(query: any): Promise<{ deletedCount?: number }> {
    return await ResponseModel.deleteMany(query);
  }
}
