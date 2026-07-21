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

export interface PublicFormField {
  fieldId?: string;
  pageId?: string;
  label: string;
  type: string;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  minDate?: string;
  maxDate?: string;
  options?: string[];
  maxFileSize?: number;
  allowedMimeTypes?: string[];
  logicRules?: Array<{
    ruleId?: string;
    targetFieldId: string;
    condition?: any;
    operator?: string;
    value?: string;
    action: "show" | "hide";
  }>;
}

export interface PublicFormPage {
  id: string;
  order: number;
  title?: string;
  description?: string;
}

export interface PublicFormBranding {
  primaryColor?: string;
  logoUrl?: string;
  coverImageUrl?: string;
}

export interface PublicFormSettings {
  successMessage?: string;
  layout?: "single_column" | "two_column" | "compact";
  responseLimitEnabled?: boolean;
  responseLimit?: number;
  closeDate?: string;
}

export interface PublicFormResponse {
  _id: string;
  title: string;
  description?: string;
  status: "published";
  fields: PublicFormField[];
  pages: PublicFormPage[];
  branding?: PublicFormBranding;
  settings?: PublicFormSettings;
  publishedSlug: string;
  publishedAt: Date;
}

export interface PublicSubmitResponse {
  success: boolean;
  message: string;
  submission?: any;
}
