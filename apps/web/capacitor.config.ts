import { type CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.credentiallens.app",
  appName: "Credential Lens",
  webDir: "out",
  
  server: {
    allowNavigation: [
      "credential-lens-api-54011184572.asia-south1.run.app",
    ],
  },
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0f0f0f",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
