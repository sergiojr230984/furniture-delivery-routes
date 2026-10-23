"use client";

// Leaflet touches `window` at import time, so it can only ever run in the
// browser. Server Components can't pass `ssr: false` to next/dynamic
// themselves — that option is only valid from within a Client Component —
// so this thin wrapper exists purely to let server pages (the customer
// tracking page, the dispatch board) render a live map without crashing
// during server-side rendering.
import dynamic from "next/dynamic";

const LiveMap = dynamic(() => import("./LiveMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-lg bg-navy-50 text-sm text-navy-400">
      Loading map…
    </div>
  ),
});

export default LiveMap;
