import PocketBase from 'pocketbase';

const pb = new PocketBase(import.meta.env.VITE_PB_URL || 'http://localhost:8090');

// Disable auto-cancellation — React StrictMode double-invokes effects,
// which causes the SDK to cancel the first request as a "duplicate".
pb.autoCancellation(false);

export default pb;
