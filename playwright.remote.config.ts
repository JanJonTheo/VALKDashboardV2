import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: ["remote-mobile.spec.ts", "remote-screen.spec.ts"],
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "chromium-phone",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "webkit-ipad-portrait",
      use: { ...devices["iPad Pro 11"], browserName: "webkit" },
    },
    {
      name: "webkit-ipad-landscape",
      use: { ...devices["iPad Pro 11 landscape"], browserName: "webkit" },
    },
    {
      name: "webkit-iphone",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
});
