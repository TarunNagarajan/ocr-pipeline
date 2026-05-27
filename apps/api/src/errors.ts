import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "request_error"
  ) {
    super(message);
  }
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "validation_error",
        message: "The request payload is invalid.",
        details: error.flatten()
      }
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
  }

  return res.status(500).json({
    error: {
      code: "internal_error",
      message: "Something went wrong while processing the request."
    }
  });
}

