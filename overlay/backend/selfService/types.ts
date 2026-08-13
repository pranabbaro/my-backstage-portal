export type JsonRecord = Record<string, unknown>;

export interface SelfServiceLogger {
  info(message: string): void;
  error(message: string): void;
}
