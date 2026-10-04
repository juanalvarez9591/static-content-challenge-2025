export class AppError extends Error {
  constructor(message, { code, cause } = {}) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class ContentReadError extends AppError {
  constructor(message, options) {
    super(message, { code: 'CONTENT_READ_FAILED', ...options });
  }
}

export class TemplateMissingError extends AppError {
  constructor(message, options) {
    super(message, { code: 'TEMPLATE_MISSING', ...options });
  }
}

export class TemplateInvalidError extends AppError {
  constructor(message, options) {
    super(message, { code: 'TEMPLATE_INVALID', ...options });
  }
}

export function serializeError(err) {
  return {
    type: err?.name ?? 'Error',
    message: err?.message ?? String(err),
    code: err?.code ?? err?.cause?.code,
  };
}
