import mongoose, { Schema, Document } from "mongoose";

export interface IAuthOtp extends Document {
  uid: string;
  codeHash: string;
  attempts: number;
  consumed: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const AuthOtpSchema: Schema = new Schema(
  {
    uid: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export default mongoose.model<IAuthOtp>("AuthOtp", AuthOtpSchema);
