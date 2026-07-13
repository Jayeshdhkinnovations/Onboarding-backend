export type FormStatus = "draft" | "published" | "closed";

export interface PublishFormResponse {
  _id: string;
  status: "published";
  slug: string;
  publishedAt: Date;
  success: true;
}

export interface CloseFormResponse {
  _id: string;
  status: "closed";
  success: true;
}
