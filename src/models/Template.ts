import mongoose, { Schema, Document } from "mongoose";
import { IFormField, FormFieldSchema } from "./Form";

export interface ITemplate extends Document {
  name: string;
  category: string;
  fields: IFormField[];
  theme: string;
  isActive: boolean;
}

const TemplateSchema = new Schema<ITemplate>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    fields: {
      type: [FormFieldSchema],
      required: true,
      default: [],
    },
    theme: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Template = mongoose.model<ITemplate>("Template", TemplateSchema);
export default Template;
