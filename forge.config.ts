import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { WebpackPlugin } from "@electron-forge/plugin-webpack";

import { mainConfig } from "./config/webpack.main.config";
import { rendererConfig } from "./config/webpack.renderer.config";
import path from "path";

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: "fun.upup.frogmusic",
    icon: path.resolve(__dirname, "res/logo"),
    executableName: "FrogMusic",
    win32metadata: {
      CompanyName: "FrogMusic",
      FileDescription: "FrogMusic",
      InternalName: "FrogMusic",
      OriginalFilename: "FrogMusic.exe",
      ProductName: "FrogMusic",
    },
    extraResource: [path.resolve(__dirname, "res")],
    protocols: [
      {
        name: "FrogMusic",
        schemes: ["frogmusic"],
      },
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      exe: "FrogMusic.exe",
      setupExe: "FrogMusicSetup.exe",
      setupIcon: path.resolve(__dirname, "res/logo.ico"),
    }),
    new MakerZIP({}, ["darwin"]),
    new MakerDMG(
      {
        // background
        format: "ULFO",
      },
      ["darwin"]
    ),
    // new MakerRpm({}),
    new MakerDeb({
      options: {
        name: "FrogMusic",
        bin: "FrogMusic",
        mimeType: ["x-scheme-handler/frogmusic"],
      },
    }),
  ],
  plugins: [
    new WebpackPlugin({
      devContentSecurityPolicy: `default-src * self blob: data: gap: file:; style-src * self 'unsafe-inline' blob: data: gap: file:; script-src * 'self' 'unsafe-eval' 'unsafe-inline' blob: data: gap: file:; object-src * 'self' blob: data: gap:; img-src * self 'unsafe-inline' blob: data: gap: file:; connect-src self * 'unsafe-inline' blob: data: gap:; frame-src * self blob: data: gap:;`,
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: "./src/renderer/document/index.html",
            js: "./src/renderer/document/index.tsx",
            name: "main_window",
            preload: {
              js: "./src/preload/index.ts",
            },
          },
          {
            html: "./src/renderer-lrc/document/index.html",
            js: "./src/renderer-lrc/document/index.tsx",
            name: "lrc_window",
            preload: {
              js: "./src/preload/extension.ts",
            },
          },
          {
            html: "./src/renderer-minimode/document/index.html",
            js: "./src/renderer-minimode/document/index.tsx",
            name: "minimode_window",
            preload: {
              js: "./src/preload/extension.ts",
            },
          },
          /** webworkers */
          {
            js: "./src/webworkers/downloader.ts",
            name: "worker_downloader",
            nodeIntegration: true,
          },
          {
            js: "./src/webworkers/local-file-watcher.ts",
            name: "local_file_watcher",
            nodeIntegration: true,
          },
          {
            js: "./src/webworkers/db-worker.ts",
            name: "db",
            nodeIntegration: true,
          }
        ],
      },
    }),
    {
      name: "@timfish/forge-externals-plugin",
      config: {
        externals: ["sharp"],
        includeDeps: true,
      },
    },
  ],
};

export default config;
