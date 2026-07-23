import mongoose, { Schema, Document } from "mongoose";

export interface IResponse extends Document {
  formId: mongoose.Types.ObjectId;
  answers: Record<string, any>;
  submittedAt?: Date;
  ipHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ResponseSchema = new Schema<IResponse>(
  {
    formId: {
      type: Schema.Types.ObjectId,
      ref: "Form",
      required: true,
      index: true,
    },
    answers: {
      type: Schema.Types.Mixed,
      required: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    ipHash: {
      type: String,
      index: true,
    },
  },
  { timestamps: true }
);

const ResponseModel = mongoose.model<IResponse>("Response", ResponseSchema);
export default ResponseModel;
