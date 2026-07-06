import Form, { IForm } from "../models/Form";

export class FormRepository {
  async create(data: Partial<IForm>): Promise<IForm> {
    return await Form.create(data);
  }

  async findById(id: string): Promise<IForm | null> {
    return await Form.findById(id);
  }

  async findOne(query: any): Promise<IForm | null> {
    return await Form.findOne(query);
  }

  async findWithPagination(
    query: any,
    skip: number,
    limit: number
  ): Promise<IForm[]> {
    return await Form.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
  }

  async count(query: any): Promise<number> {
    return await Form.countDocuments(query);
  }

  async update(id: string, data: Partial<IForm>): Promise<IForm | null> {
    return await Form.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id: string): Promise<IForm | null> {
    return await Form.findByIdAndDelete(id);
  }
}
