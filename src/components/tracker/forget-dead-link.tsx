"use client";

import { useEffect } from "react";
import { forgetTracker } from "@/lib/saved-tracker";

/**
 * Rendered on the 404 page. If this phone saved the tracker at this address
 * and it no longer exists (rotated on the other phone), stop offering it on
 * the home page. Renders nothing.
 */
export function ForgetDeadLink() {
  useEffect(() => {
    const m = /^\/t\/([0-9A-Za-z]{16,32})\/?$/.exec(window.location.pathname);
    if (m) forgetTracker(m[1]);
  }, []);
  return null;
}
