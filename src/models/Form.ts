import mongoose, { Schema, Document } from "mongoose";

export interface IFormField {
  label: string;
  type: "text" | "number" | "dropdown" | "textarea" | "checkbox" | "email";
  required: boolean;
  options?: string[];
}

export interface IForm extends Document {
  title: string;
  description?: string;
  workspaceId: mongoose.Types.ObjectId;
  status: "active" | "inactive";
  fields: IFormField[];
  createdAt: Date;
  updatedAt: Date;
}

const FormFieldSchema = new Schema<IFormField>({
  label: { type: String, required: true, trim: true },
  type: {
    type: String,
    required: true,
    enum: ["text", "number", "dropdown", "textarea", "checkbox", "email"],
  },
  required: { type: Boolean, default: false },
  options: { type: [String], default: [] },
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
  },
  { timestamps: true }
);

const Form = mongoose.model<IForm>("Form", FormSchema);
export default Form;
