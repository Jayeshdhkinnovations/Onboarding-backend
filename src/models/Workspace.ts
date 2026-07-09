import mongoose, { Schema, Document } from "mongoose";
export interface IWorkspace extends Document {
  name: string;
  description?: string;
  logo?: string;
  owner: mongoose.Types.ObjectId;
  status: "active";
}
const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    logo: {
      type: String,
      default: "",
    },

    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);
const Workspace = mongoose.model<IWorkspace>(
  "Workspace",
  WorkspaceSchema
);

export default Workspace;