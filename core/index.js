// Entry point bundled into n8n Code nodes as the global `PK`.
import './auth.js';
import './recipes.js';
import './stock.js';
import './shopping.js';

export { handle, applyWrites } from './handle.js';
export { authenticate } from './session.js';
export { TABLES, STATE_KEYS, serialize, deserialize, stateFromTables } from './schema.js';
