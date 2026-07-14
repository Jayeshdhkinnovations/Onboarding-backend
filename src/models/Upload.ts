import mongoose, { Schema, Document } from "mongoose";

export interface IUpload extends Document {
  name: string;
  size: number;
  type: string;
  path: string;
  owner: mongoose.Types.ObjectId;
  uploadTime: Date;
}

const UploadSchema = new Schema<IUpload>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    uploadTime: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Upload = mongoose.model<IUpload>("Upload", UploadSchema);
export default Upload;
