import mongoose, { Schema, Document } from "mongoose";

export interface ISystemLog extends Document {
  level: "info" | "warn" | "error";
  message: string;
  route?: string;
  statusCode?: number;
  meta?: Record<string, any>;
  stack?: string;
  createdAt: Date;
}

const SystemLogSchema = new Schema<ISystemLog>({
  level: { type: String, enum: ["info", "warn", "error"], required: true, index: true },
  message: { type: String, required: true },
  route: { type: String },
  statusCode: { type: Number },
  meta: { type: Schema.Types.Mixed },
  stack: { type: String },
  createdAt: { type: Date, default: Date.now, expires: "30d" }
});

export const SystemLog = mongoose.model<ISystemLog>("SystemLog", SystemLogSchema);
