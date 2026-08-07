import mongoose, { Schema, Document } from "mongoose";

export interface IAuthTicket extends Document {
  firebaseUid: string;
  purpose: string;
  ticketHash: string;
  expiresAt: Date;
  consumed: boolean;
  consumedAt?: Date;
  createdAt: Date;
}

const AuthTicketSchema: Schema = new Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      required: true,
      default: "reveal_verify_email_code",
    },
    ticketHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    consumed: {
      type: Boolean,
      default: false,
    },
    consumedAt: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AuthTicketSchema.index({ ticketHash: 1, purpose: 1, consumed: 1 });

export default mongoose.model<IAuthTicket>("AuthTicket", AuthTicketSchema);
