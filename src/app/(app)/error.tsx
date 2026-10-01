"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="yev-frame shell-layout">
      <div className="shell-context">
        <h1>Something went wrong</h1>
      </div>
      <div className="empty-state yev-stack">
        <p>This page could not be loaded. Your data is unchanged.</p>
        <div>
          <button type="button" className="yev-button yev-button-outline" onClick={reset}>
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
