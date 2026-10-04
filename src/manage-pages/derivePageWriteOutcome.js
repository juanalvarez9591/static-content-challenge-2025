import { validatePagePath } from './validatePagePath.js';

export const PageAction = Object.freeze({ READ: 'read', CREATE: 'create', UPDATE: 'update', DELETE: 'delete' });

export const WriteOutcome = Object.freeze({
  ALLOWED: 'ALLOWED',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_PATH: 'INVALID_PATH',
});

export function derivePageWriteOutcome({ action, path, existingFolders }) {
  const checked = validatePagePath(path);
  if (!checked.ok) {
    return action === PageAction.CREATE
      ? { type: WriteOutcome.INVALID_PATH, reason: checked.reason }
      : { type: WriteOutcome.NOT_FOUND };
  }
  const exists = existingFolders.includes(checked.folderPath);
  if (action === PageAction.CREATE) {
    return exists
      ? { type: WriteOutcome.ALREADY_EXISTS }
      : { type: WriteOutcome.ALLOWED, action, folderPath: checked.folderPath };
  }
  return exists
    ? { type: WriteOutcome.ALLOWED, action, folderPath: checked.folderPath }
    : { type: WriteOutcome.NOT_FOUND };
}

export function deriveRepositoryResult(allowed, accepted) {
  if (accepted) return allowed;
  return allowed.action === PageAction.CREATE
    ? { type: WriteOutcome.INVALID_PATH, reason: 'repository_refused' }
    : { type: WriteOutcome.NOT_FOUND };
}
