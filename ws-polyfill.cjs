// Deployment shim: @supabase/realtime-js requires a global WebSocket, which
// Node.js 20 does not provide. The supabase client is only used for storage
// (signed uploads), but it eagerly constructs a RealtimeClient on init. The
// websocket-factory checks `global.WebSocket` first, so injecting `ws` here
// satisfies it without modifying application source. Preloaded via `node -r`.
global.WebSocket = require('ws');
