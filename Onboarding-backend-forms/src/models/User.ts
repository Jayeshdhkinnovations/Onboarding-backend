import mongoose, { Schema, Document } from "mongoose";
export interface IUser extends Document {
  firebaseUid: string;
  fullName: string;
  email: string;
  role: "admin";
  workspaceId: mongoose.Types.ObjectId;
  isActive: boolean;
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
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>("User", UserSchema);

export default User;