import PocketBase from "pocketbase";

const pb = new PocketBase(
  process.env.NEXT_PUBLIC_PB_URL || "http://localhost:8090"
);

// Disable auto-cancellation (React StrictMode double-invokes effects)
pb.autoCancellation(false);

export default pb;
