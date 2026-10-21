export type IngestionErrorCode =
  | "unsupported_type"
  | "type_mismatch"
  | "file_too_large"
  | "submission_too_large"
  | "too_many_files"
  | "duplicate_file"
  | "empty_file"
  | "pdf_too_many_pages"
  | "pdf_encrypted"
  | "pdf_unreadable"
  | "image_unreadable"
  | "invalid_figma_url"
  | "too_many_links"
  | "storage_error"
  | "not_editable";

export class IngestionError extends Error {
  readonly code: IngestionErrorCode;
  readonly params: Record<string, string | number>;
  constructor(code: IngestionErrorCode, message: string, params: Record<string, string | number> = {}) {
    super(message);
    this.name = "IngestionError";
    this.code = code;
    this.params = params;
  }
}
