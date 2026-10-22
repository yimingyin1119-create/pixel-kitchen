// Bundle entry for n8n Code nodes. n8n's sandbox replaces Object.defineProperty with a no-op,
// which breaks esbuild's export getters, so the API is handed over as a plain object instead.
import { handle, applyWrites, authenticate, TABLES, STATE_KEYS, serialize, deserialize, stateFromTables } from './index.js';

// eslint-disable-next-line no-undef
PK_SINK({ handle, applyWrites, authenticate, TABLES, STATE_KEYS, serialize, deserialize, stateFromTables });
