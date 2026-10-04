import { HttpStatus } from '../shared/http/status.js';
import { PageAction, WriteOutcome, derivePageWriteOutcome, deriveRepositoryResult } from './derivePageWriteOutcome.js';
import { parsePage } from '../page/page.js';

export const MAX_MARKDOWN_BYTES = 200 * 1024;
const MAX_PATH = 300;

const STATUS_BY_ACTION = {
  [PageAction.READ]: HttpStatus.OK,
  [PageAction.CREATE]: HttpStatus.CREATED,
  [PageAction.UPDATE]: HttpStatus.OK,
  [PageAction.DELETE]: HttpStatus.NO_CONTENT,
};
export const RESPONSE_BY_OUTCOME = {
  [WriteOutcome.ALREADY_EXISTS]: { status: HttpStatus.CONFLICT, error: 'exists' },
  [WriteOutcome.NOT_FOUND]: { status: HttpStatus.NOT_FOUND, error: 'not_found' },
  [WriteOutcome.INVALID_PATH]: { status: HttpStatus.BAD_REQUEST, error: 'invalid_path' },
};

const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const EVENT_ACTION = { create: 'page_created', update: 'page_updated', delete: 'page_deleted' };

export function makeManagePagesController({ repo }) {
  async function run(req, res, action, { path, markdown }, perform) {
    const event = res.locals.event;
    let outcome = derivePageWriteOutcome({ action, path, existingFolders: await repo.listFolders() });
    let result;
    if (outcome.type === WriteOutcome.ALLOWED) {
      result = await perform(outcome.folderPath);
      outcome = deriveRepositoryResult(outcome, result !== undefined && result !== false);
    }
    if (outcome.reason) event.rejected_by = outcome.reason;

    if (outcome.type !== WriteOutcome.ALLOWED) {
      const { status, error } = RESPONSE_BY_OUTCOME[outcome.type];
      return res.status(status).json({ error });
    }
    if (EVENT_ACTION[action]) {
      event.admin_action = EVENT_ACTION[action];
      event.content_folder = outcome.folderPath;
    }
    const status = STATUS_BY_ACTION[action];
    if (action === PageAction.DELETE) return res.status(status).end();
    return res.status(status).json(action === PageAction.READ ? result : { path: outcome.folderPath });
  }

  return {
    list: async (req, res) => {
      res.json({ pages: (await repo.listFolders()).filter((p) => p !== '').sort() });
    },
    read: (req, res) => run(req, res, PageAction.READ, { path: text(req.query.path, MAX_PATH) }, async (folderPath) => {
      const page = await repo.getPageByPath(folderPath);
      return page && { path: page.folderPath, markdown: page.markdown };
    }),
    create: (req, res) => {
      const body = req.body ?? {};
      return run(req, res, PageAction.CREATE, { path: text(body.path, MAX_PATH) },
        (folderPath) => repo.createPage(parsePage({ folderPath, markdown: text(body.markdown, MAX_MARKDOWN_BYTES) })));
    },
    update: (req, res) => {
      const body = req.body ?? {};
      return run(req, res, PageAction.UPDATE, { path: text(body.path, MAX_PATH) },
        (folderPath) => repo.updatePage(parsePage({ folderPath, markdown: text(body.markdown, MAX_MARKDOWN_BYTES) })));
    },
    remove: (req, res) => run(req, res, PageAction.DELETE, { path: text(req.query.path, MAX_PATH) },
      (folderPath) => repo.deletePage(folderPath)),
  };
}
