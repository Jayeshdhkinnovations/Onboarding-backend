import mongoose, { Schema, Document } from "mongoose";

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
}

export interface IForm extends Document {
  title: string;
  description?: string;
  workspaceId: mongoose.Types.ObjectId;
  status: "active" | "inactive";
  fields: IFormField[];
  schemaVersion: number;
  slug?: string;
  publishedSlug?: string;
  createdAt: Date;
  updatedAt: Date;
}

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
});

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
      enum: ["active", "inactive"],
      default: "active",
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
  },
  { timestamps: true }
);

const Form = mongoose.model<IForm>("Form", FormSchema);
export default Form;

