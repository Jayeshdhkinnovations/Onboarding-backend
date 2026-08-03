export interface IAnswer {
  fieldId?: string;
  label?: string;
  value: any;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  [key: string]: any;
}

export interface IResponse {
  _id: string;
  formId: string;
  answers: Record<string, any> | IAnswer[];
  status?: "completed" | "partial" | "flagged" | string;
  submittedAt?: Date | string;
  ipHash?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface PaginatedResponsesResult {
  data: IResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
