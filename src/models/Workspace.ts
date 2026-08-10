import mongoose, { Schema, Document } from "mongoose";
export interface INotificationPreferences {
  newResponseEmail: boolean;
  weeklyDigestEmail: boolean;
  productUpdatesEmail: boolean;
}

export interface IWorkspace extends Document {
  name: string;
  description?: string;
  logo?: string;
  logoUrl?: string | null;
  branding?: Record<string, any>;
  notificationPreferences?: INotificationPreferences;
  owner: mongoose.Types.ObjectId;
  status: "active";
  createdAt: Date;
  updatedAt: Date;
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

    logoUrl: {
      type: String,
      default: null,
    },

    branding: {
      type: Schema.Types.Mixed,
      default: {},
    },

    notificationPreferences: {
      newResponseEmail: { type: Boolean, default: true },
      weeklyDigestEmail: { type: Boolean, default: true },
      productUpdatesEmail: { type: Boolean, default: false },
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