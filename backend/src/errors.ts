export class AppError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

export class CodexServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexServiceError";
  }
}
