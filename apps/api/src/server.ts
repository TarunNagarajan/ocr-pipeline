import { config } from "./config.js";
import { createApp } from "./app.js";
import { ensureStorage } from "./storage.js";

ensureStorage()
  .then(() => {
    createApp().listen(config.PORT, () => {
      console.log(`API listening on ${config.PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize storage", error);
    process.exit(1);
  });
