import mongoose, { Schema, Document } from "mongoose";
export interface ILoginLocation {
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ILoginEntry {
  timestamp: Date;
  ip: string;
  userAgent: string;
  location?: ILoginLocation | null;
}

export interface IUser extends Document {
  firebaseUid: string;
  fullName: string;
  email: string;
  role: "admin" | "super_admin";
  workspaceId: mongoose.Types.ObjectId;
  isActive: boolean;
  status: "active" | "suspended";
  lastLogin: Date;
  loginHistory: ILoginEntry[];
}
const UserSchema = new Schema<IUser>(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    role: {
      type: String,
      enum: ["admin", "super_admin"],
      default: "admin",
    },

    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },

    lastLogin: {
      type: Date,
    },

    loginHistory: [
      {
        timestamp: { type: Date, default: Date.now },
        ip: { type: String, default: "unknown" },
        userAgent: { type: String, default: "unknown" },
        location: {
          city: { type: String, default: null },
          region: { type: String, default: null },
          country: { type: String, default: null },
          latitude: { type: Number, default: null },
          longitude: { type: Number, default: null },
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>("User", UserSchema);

export default User;