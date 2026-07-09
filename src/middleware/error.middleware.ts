import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error("Global Error Interceptor:", err);

  // Cast Error (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      message: `Cast to ObjectId failed for value "${err.value}" at path "${err.path}"`,
      error: { message: err.message }
    });
    return;
  }

  // Zod Validation Error
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
      error: { message: "Validation failed" }
    });
    return;
  }

  // Mongoose Validation Error
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      success: false,
      message: err.message,
      error: { message: err.message }
    });
    return;
  }

  // Default Error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: { message: err.message || "Internal Server Error" }
  });
};
