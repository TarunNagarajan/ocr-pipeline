"use client";

import { useEffect, useState, useMemo } from "react";

type PlatformInfo = {
    isNative: boolean;
    isAndroid: boolean;
    isIOS: boolean;
    isMobile: boolean;
    isMobileOrNative: boolean;
};

export function usePlatform(): PlatformInfo {
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return useMemo(() => {
    const isNative = typeof window !== "undefined" && !!(window as any).Capacitor?.isNativePlatform();

    return {
      isNative,
      isAndroid: isNative && (window as any).Capacitor?.getPlatform() === "android",
      isIOS: isNative && (window as any).Capacitor?.getPlatform() === "ios",
      isMobile,
      isMobileOrNative: isMobile || isNative,
    };
    
    
  }, [isMobile]);
}
