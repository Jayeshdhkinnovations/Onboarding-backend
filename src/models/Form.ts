import mongoose, { Schema, Document } from "mongoose";

export interface ILogicRule {
  ruleId?: string;
  targetFieldId: string;
  operator: "equals";
  value: string;
  action: "show" | "hide";
}

export interface IFormField {
  fieldId?: string;
  label: string;
  type:
    | "short_text"
    | "long_text"
    | "email"
    | "phone"
    | "number"
    | "date"
    | "dropdown"
    | "multiple_choice"
    | "checkbox"
    | "file_upload";
  required: boolean;
  deleted?: boolean;

  // validation settings for different field types
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
  logicRules?: ILogicRule[];
}

export interface IBranding {
  primaryColor?: string;
  logoUrl?: string;
  coverImageUrl?: string;
}

export interface IFormSettings {
  successMessage?: string;
  responseLimitEnabled?: boolean;
  responseLimit?: number;
  closeDate?: string;
  honeypotEnabled?: boolean;
}

export interface IForm extends Document {
  title: string;
  description?: string;
  workspaceId: mongoose.Types.ObjectId;
  status: "draft" | "published" | "closed";
  fields: IFormField[];
  schemaVersion: number;
  slug?: string;
  publishedSlug?: string;
  publishedAt?: Date;
  branding?: IBranding;
  settings?: IFormSettings;
  createdAt: Date;
  updatedAt: Date;
}

const LogicRuleSchema = new Schema<ILogicRule>(
  {
    ruleId: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    targetFieldId: { type: String, required: true },
    operator: { type: String, enum: ["equals"], default: "equals" },
    value: { type: String, required: true },
    action: { type: String, enum: ["show", "hide"], required: true },
  },
  { _id: false }
);

const FormFieldSchema = new Schema<IFormField>({
  fieldId: { type: String, required: true, default: () => new mongoose.Types.ObjectId().toString() },
  label: { type: String, required: true, trim: true },
  type: {
    type: String,
    required: true,
    enum: [
      "short_text",
      "long_text",
      "email",
      "phone",
      "number",
      "date",
      "dropdown",
      "multiple_choice",
      "checkbox",
      "file_upload",
    ],
  },
  required: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },

  // Validation parameters
  minLength: { type: Number },
  maxLength: { type: Number },
  pattern: { type: String },
  min: { type: Number },
  max: { type: Number },
  minDate: { type: String },
  maxDate: { type: String },
  options: { type: [String], default: [] },
  maxFileSize: { type: Number },
  allowedMimeTypes: { type: [String], default: [] },
  logicRules: { type: [LogicRuleSchema], default: [] },
});

const BrandingSchema = new Schema<IBranding>(
  {
    primaryColor: { type: String },
    logoUrl: { type: String },
    coverImageUrl: { type: String },
  },
  { _id: false }
);

const FormSettingsSchema = new Schema<IFormSettings>(
  {
    successMessage: { type: String },
    responseLimitEnabled: { type: Boolean, default: false },
    responseLimit: { type: Number },
    closeDate: { type: String },
    honeypotEnabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const FormSchema = new Schema<IForm>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "closed"],
      default: "draft",
      index: true,
    },
    fields: { type: [FormFieldSchema], default: [] },
    schemaVersion: {
      type: Number,
      default: 1,
      required: true,
    },
    slug: { type: String, unique: true, sparse: true, index: true },
    publishedSlug: { type: String, unique: true, sparse: true, index: true },
    publishedAt: { type: Date },
    branding: { type: BrandingSchema, default: {} },
    settings: { type: FormSettingsSchema, default: {} },
  },
  { timestamps: true }
);

const Form = mongoose.model<IForm>("Form", FormSchema);
export default Form;

