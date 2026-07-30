import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import fs from "fs";
import path from "path";
import { setAutoFreeze } from "immer";
import { setupGlobalContext } from "@/shared/global-context/main";
import { setupI18n } from "@/shared/i18n/main";
import { handleDeepLink } from "./deep-link";
import logger from "@shared/logger/main";
import { PlayerState } from "@/common/constant";
import ThumbBarUtil from "@/common/thumb-bar-util";
import windowManager from "@main/window-manager";
import AppConfig from "@shared/app-config/main";
import TrayManager from "@main/tray-manager";
import WindowDrag from "@shared/window-drag/main";
import { IAppConfig } from "@/types/app-config";
import axios from "axios";
import CryptoJS from "crypto-js";
import bigInt from "big-integer";
import qs from "qs";
import { HttpsProxyAgent } from "https-proxy-agent";
import PluginManager from "@shared/plugin-manager/main";
import ServiceManager from "@shared/service-manager/main";
import utils from "@shared/utils/main";
import messageBus from "@shared/message-bus/main";
import shortCut from "@shared/short-cut/main";
import voidCallback from "@/common/void-callback";

// portable
if (process.platform === "win32") {
    try {
        const appPath = app.getPath("exe");
        const portablePath = path.resolve(appPath, "../portable");
        const portableFolderStat = fs.statSync(portablePath);
        if (portableFolderStat.isDirectory()) {
            const appPathNames = ["appData", "userData"];
            appPathNames.forEach((it) => {
                app.setPath(it, path.resolve(portablePath, it));
            });
        }
    } catch (e) {
        // pass
    }
}

setAutoFreeze(false);


if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient("frogmusic", process.execPath, [
            path.resolve(process.argv[1]),
        ]);
    }
} else {
    app.setAsDefaultProtocolClient("frogmusic");
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.showMainWindow();
    }
});

if (!app.requestSingleInstanceLock()) {
    app.exit(0);
}

app.on("second-instance", (_evt, commandLine) => {
    if (windowManager.miniModeWindow && !windowManager.miniModeWindow.isDestroyed()) {
        windowManager.showMiniModeWindow();
    } else if (windowManager.mainWindow) {
        windowManager.showMainWindow();
    }

    if (process.platform !== "darwin") {
        handleDeepLink(commandLine.pop());
    }
});

app.on("open-url", (_evt, url) => {
    handleDeepLink(url);
});

app.on("will-quit", () => {
    globalShortcut.unregisterAll();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
app.whenReady().then(async () => {
    logger.logPerf("App Ready");
    setupGlobalContext();
    await AppConfig.setup(windowManager);

    await setupI18n({
        getDefaultLang() {
            return AppConfig.getConfig("normal.language");
        },
        onLanguageChanged(lang) {
            AppConfig.setConfig({
                "normal.language": lang,
            });
            if (process.platform === "win32") {

                ThumbBarUtil.setThumbBarButtons(windowManager.mainWindow, messageBus.getAppState().playerState === PlayerState.Playing);
            }
        },
    });
    utils.setup(windowManager);
    PluginManager.setup(windowManager);

    type PlatformKey = "qq" | "netease";
    type UserPlaylist = { id: string; title: string; count: number };
    type NeteaseRecommendationItem = {
        key: "daily" | "personalFm" | "privateRadar";
        title: string;
        count: number;
        musicItems?: IMusic.IMusicItem[];
        playlistId?: string;
        description?: string;
    };
    const loginConfigs: Record<PlatformKey, { url: string; cookieKeys: string[]; name: string }> = {
        qq: {
            url: "https://y.qq.com",
            cookieKeys: ["uin", "qqmusic_key"],
            name: "QQ音乐",
        },
        netease: {
            url: "https://music.163.com",
            cookieKeys: ["MUSIC_U"],
            name: "网易云",
        },
    };

    // === playlist import handler ===
    ipcMain.handle("plugin-import-playlists", async (_evt, platform: PlatformKey, playlistIds: string[]) => {
        var pluginName = platform === "qq" ? "QQ音乐" : "网易云";
        var plugin = PluginManager.plugins.find(function(p: any) { return p.name === pluginName; });
        if (!plugin) {
            return { success: false, reason: "Plugin not found: " + pluginName };
        }
        var imported: Array<{id: string; title: string; count: number}> = [];
        var failed: string[] = [];
        for (var i = 0; i < playlistIds.length; i++) {
            try {
                var items = await plugin.methods.importMusicSheet(playlistIds[i]);
                if (items && items.length > 0) {
                    imported.push({ id: playlistIds[i], title: "", count: items.length });
                } else {
                    failed.push(playlistIds[i]);
                }
            } catch (e) {
                failed.push(playlistIds[i]);
            }
        }
        return { success: true, imported: imported, failed: failed };
    });
    // === end playlist import handler ===

    ipcMain.handle("plugin-get-user-playlists", async (_evt, platform: PlatformKey) => {
        const cfg = loginConfigs[platform];
        if (!cfg) {
            return { success: false, reason: "Unknown platform: " + platform, playlists: [] };
        }
        const savedCookie = await getSavedCookie(platform, cfg);
        if (!savedCookie) {
            return { success: false, reason: "Not logged in", playlists: [] };
        }
        const playlists = await fetchUserPlaylists(platform, savedCookie);
        console.log("plugin-get-user-playlists:", platform, playlists.length);
        return { success: true, platform: cfg.name, playlists };
    });

    ipcMain.handle("plugin-get-netease-recommendations", async () => {
        const cfg = loginConfigs.netease;
        const savedCookie = await getSavedCookie("netease", cfg);
        if (!savedCookie) {
            return { success: false, reason: "Not logged in", recommendations: [] };
        }
        try {
            const recommendations = await fetchNeteaseRecommendations(savedCookie);
            return { success: true, recommendations };
        } catch (e) {
            console.log("fetchNeteaseRecommendations error:", getHttpErrorSummary(e));
            return {
                success: false,
                reason: getHttpErrorSummary(e),
                recommendations: [],
            };
        }
    });

    // === Login helper: opens platform login window, extracts cookies ===
    ipcMain.handle("plugin-login", async (_evt, platform: PlatformKey) => {
        const cfg = loginConfigs[platform];
        if (!cfg) {
            return { success: false, reason: "Unknown platform: " + platform };
        }

        // Check if already logged in from main session
        const existingCookies = await windowManager.mainWindow.webContents.session.cookies.get({ url: cfg.url });
        const alreadyLoggedIn = cfg.cookieKeys.some((k) => existingCookies.some((c) => c.name === k));
        if (alreadyLoggedIn) {
            return await extractAndSaveCookies(windowManager.mainWindow.webContents.session, platform, cfg);
        }

        // Open login window
        const loginWindow = new BrowserWindow({
            width: 800,
            height: 700,
            title: cfg.name + " 登录",
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
        });

        await loginWindow.loadURL(cfg.url);

        return new Promise((resolve) => {
            let resolved = false;
            const checkInterval = setInterval(async () => {
                if (resolved) return;
                try {
                    const cookies = await loginWindow.webContents.session.cookies.get({ url: cfg.url });
                    const found = cfg.cookieKeys.some((k) => cookies.some((c) => c.name === k));
                    if (found) {
                        resolved = true;
                        clearInterval(checkInterval);
                        const result = await extractAndSaveCookies(loginWindow.webContents.session, platform, cfg);
                        // Also copy cookies to main window session
                        for (const c of cookies) {
                            await windowManager.mainWindow.webContents.session.cookies.set({
                                url: cfg.url,
                                name: c.name,
                                value: c.value,
                                domain: c.domain,
                                path: c.path,
                                secure: c.secure,
                                httpOnly: c.httpOnly,
                                expirationDate: c.expirationDate,
                            });
                        }
                        loginWindow.close();
                        resolve(result);
                    }
                } catch (e) {
                    // pass
                }
            }, 1500);

            loginWindow.on("closed", () => {
                if (!resolved) {
                    resolved = true;
                    clearInterval(checkInterval);
                    resolve({ success: false, reason: "window closed" });
                }
            });
        });
    });

    async function extractAndSaveCookies(
        ses: Electron.Session,
        platform: PlatformKey,
        cfg: { url: string; cookieKeys: string[]; name: string }
    ) {
        const cookies = await ses.cookies.get({ url: cfg.url });
        const allCookieStr = cookies.map((c) => c.name + "=" + c.value).join("; ");

        const meta = AppConfig.getConfig("private.pluginMeta") ?? {};

        if (cfg.name === "QQ音乐") {
            const uinCookie = cookies.find((c) => c.name === "uin");
            const uin = uinCookie?.value?.replace(/\D/g, "") ?? "";
            meta["QQ音乐"] = {
                ...(meta["QQ音乐"] ?? {}),
                userVariables: {
                    ...(meta["QQ音乐"]?.userVariables ?? {}),
                    qqUin: uin,
                    qqCookie: allCookieStr,
                },
            };
        } else if (cfg.name === "网易云") {
            const muCookie = cookies.find((c) => c.name === "MUSIC_U");
            meta["网易云"] = {
                ...(meta["网易云"] ?? {}),
                userVariables: {
                    ...(meta["网易云"]?.userVariables ?? {}),
                    musiceU: muCookie?.value ?? "",
                },
            };
        }

        AppConfig.setConfig({ "private.pluginMeta": meta });

        // Fetch user playlists
        var playlists: Array<{id: string; title: string; count: number}> = [];
        try {
            playlists = await fetchUserPlaylists(platform, allCookieStr);
        } catch (e) {
            console.log("Failed to fetch playlists:", platform, getHttpErrorSummary(e));
        }
        return { success: true, platform: cfg.name, playlists: playlists };
    }

    async function getSavedCookie(platform: PlatformKey, cfg: { url: string; name: string }) {
        const userVariables = getSavedPluginUserVariables(platform, cfg);
        if (platform === "qq" && userVariables.qqCookie) {
            return userVariables.qqCookie as string;
        }
        if (platform === "netease") {
            const musicU = userVariables.musiceU ?? userVariables.MUSIC_U ?? userVariables.musicU;
            if (musicU) {
                return `appver=8.0.0; os=pc; MUSIC_U=${musicU}`;
            }
        }

        const cookies = await windowManager.mainWindow.webContents.session.cookies.get({ url: cfg.url });
        if (!cookies.length) {
            return "";
        }
        return cookies.map((c) => c.name + "=" + c.value).join("; ");
    }

    function getQQGtk(cookie: string) {
        const skey = (cookie.match(/skey=([^;]+)/) || [])[1] || (cookie.match(/p_skey=([^;]+)/) || [])[1] || "";
        let hash = 5381;
        for (let i = 0; i < skey.length; i++) {
            hash += (hash << 5) + skey.charCodeAt(i);
        }
        return hash & 0x7fffffff;
    }

    function getHttpErrorSummary(e: any) {
        return e?.response?.status ?? e?.code ?? e?.message ?? String(e);
    }

    function getSavedPluginUserVariables(platform: PlatformKey, cfg: { name: string }) {
        const meta = AppConfig.getConfig("private.pluginMeta") ?? {};
        const metaKey = Object.keys(meta).find(
            (key) => key === cfg.name || (platform === "qq" ? key.startsWith("QQ") : key.includes("云")),
        );
        return metaKey ? meta[metaKey]?.userVariables ?? {} : {};
    }

    async function fetchUserPlaylists(platform: PlatformKey, cookie: string): Promise<UserPlaylist[]> {
        try {
            if (platform === "qq") {
                // QQ Music: get user playlists via proper API
                var uin = (cookie.match(/uin=([^;]+)/) || [])[1] || "";
                uin = uin.replace(/\D/g, "");
                if (!uin) {
                    const userVariables = getSavedPluginUserVariables(platform, loginConfigs.qq);
                    uin = String(userVariables.qqUin ?? "").replace(/\D/g, "");
                }
                if (!uin) {
                    console.log("fetchUserPlaylists qq: missing uin");
                    return [];
                }
                var resp = await axios.get("https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss", {
                    params: {
                        hostuin: uin,
                        hostUin: uin,
                        loginUin: uin,
                        sin: 0,
                        size: 200,
                        g_tk: getQQGtk(cookie),
                        format: "json",
                        inCharset: "utf8",
                        outCharset: "utf-8",
                        platform: "yqq.json",
                        needNewCode: 0,
                    },
                    headers: { Cookie: cookie, Referer: "https://y.qq.com/n/ryqq/profile/like/song", "User-Agent": "Mozilla/5.0" },
                });
                if (resp.data?.code === 0 && resp.data?.data?.disslist) {
                    return resp.data.data.disslist
                        .map((p: any) => ({
                            id: String(p.tid || p.dissid || ""),
                            title: p.diss_name || p.title || p.dissname || "",
                            count: p.song_cnt || p.songnum || p.song_count || 0,
                        }))
                        .filter((p: UserPlaylist) => p.id && p.id !== "0" && p.title);
                }
                console.log("fetchUserPlaylists qq: unexpected response", resp.data?.code);
            } else if (platform === "netease") {
                // NetEase: get user playlists
                const account = (await axios.get("https://music.163.com/api/nuser/account/get", {
                    headers: { Cookie: cookie, Referer: "https://music.163.com/", "User-Agent": "Mozilla/5.0" },
                })).data;
                const uid = account?.profile?.userId;
                if (!uid) {
                    console.log("fetchUserPlaylists netease: missing uid", account?.code);
                    return [];
                }
                const result = (await axios.get(`https://music.163.com/api/user/playlist?uid=${uid}&limit=500&offset=0`, {
                    headers: { Cookie: cookie, Referer: "https://music.163.com/", "User-Agent": "Mozilla/5.0" },
                })).data;
                if (result?.playlist) {
                    return result.playlist.map((p: any) => ({
                        id: String(p.id),
                        title: p.name,
                        count: p.trackCount || 0,
                    })).filter((p: UserPlaylist) => p.id && p.title);
                }
                console.log("fetchUserPlaylists netease: unexpected response", result?.code);
            }
        } catch (e) {
            console.log("fetchUserPlaylists error:", platform, getHttpErrorSummary(e));
        }
        return [];
    }

    function getCookieValue(cookie: string, key: string) {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return (cookie.match(new RegExp(`(?:^|;\\s*)${escapedKey}=([^;]*)`)) ?? [])[1] ?? "";
    }

    function createNeteaseWeapiPayload(data: Record<string, any>) {
        const randomKeyAlphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let randomKey = "";
        for (let i = 0; i < 16; i++) {
            randomKey += randomKeyAlphabet.charAt(
                Math.floor(Math.random() * randomKeyAlphabet.length),
            );
        }

        const encrypt = (text: string, key: string) => {
            return CryptoJS.AES.encrypt(
                CryptoJS.enc.Utf8.parse(text),
                CryptoJS.enc.Utf8.parse(key),
                {
                    iv: CryptoJS.enc.Utf8.parse("0102030405060708"),
                    mode: CryptoJS.mode.CBC,
                    padding: CryptoJS.pad.Pkcs7,
                },
            ).toString();
        };

        const firstPass = encrypt(JSON.stringify(data), "0CoJUm6Qyw8W8jud");
        const params = encrypt(firstPass, randomKey);
        const reversedKey = randomKey.split("").reverse().join("");
        const hexKey = reversedKey
            .split("")
            .map((char) => char.charCodeAt(0).toString(16))
            .join("");
        const modulus = "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7";
        const encSecKey = bigInt(hexKey, 16)
            .modPow(bigInt("010001", 16), bigInt(modulus, 16))
            .toString(16)
            .padStart(256, "0");

        return { params, encSecKey };
    }

    async function requestNeteaseWeapi(
        apiPath: string,
        data: Record<string, any>,
        cookie: string,
    ) {
        const normalizedPath = apiPath
            .replace(/^\/+/, "")
            .replace(/^(?:api|weapi)\//, "");
        const csrfToken = getCookieValue(cookie, "__csrf");
        const payload = createNeteaseWeapiPayload({
            ...data,
            csrf_token: data.csrf_token ?? csrfToken,
        });
        const response = await axios.post(
            `https://music.163.com/weapi/${normalizedPath}`,
            qs.stringify(payload),
            {
                headers: {
                    Cookie: cookie,
                    Referer: "https://music.163.com/",
                    Origin: "https://music.163.com",
                    "Content-Type": "application/x-www-form-urlencoded",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
                timeout: 15000,
            },
        );
        return response.data;
    }

    function formatNeteaseMusicItem(song: any): IMusic.IMusicItem | null {
        const item = song?.song ?? song;
        if (!item?.id || !item?.name) {
            return null;
        }

        const album = item.al ?? item.album ?? {};
        const artists = Array.isArray(item.ar)
            ? item.ar
            : Array.isArray(item.artists)
                ? item.artists
                : [];
        const artist = artists
            .map((item: any) => item?.name)
            .filter(Boolean)
            .join(" / ") || "未知歌手";

        return {
            id: String(item.id),
            platform: "网易云",
            artwork: album.picUrl ?? album.blurPicUrl,
            title: item.name,
            artist,
            album: album.name,
            duration: Math.floor((item.dt ?? item.duration ?? 0) / 1000),
            url: `https://music.163.com/song/media/outer/url?id=${item.id}.mp3`,
            qualities: {
                low: { size: item.l?.size },
                standard: { size: item.m?.size },
                high: { size: item.h?.size },
                super: { size: item.sq?.size },
            },
            copyrightId: item.copyrightId,
        };
    }

    async function fetchNeteaseRecommendations(
        cookie: string,
    ): Promise<NeteaseRecommendationItem[]> {
        const requestResults = await Promise.allSettled([
            requestNeteaseWeapi("v3/discovery/recommend/songs", {}, cookie),
            requestNeteaseWeapi("v1/radio/get", {}, cookie),
            requestNeteaseWeapi("v1/discovery/recommend/resource", {}, cookie),
        ]);
        const recommendations: NeteaseRecommendationItem[] = [];

        const dailyResult = requestResults[0];
        if (dailyResult.status === "fulfilled") {
            const dailySongs = dailyResult.value?.data?.dailySongs
                ?? dailyResult.value?.recommend
                ?? dailyResult.value?.songs
                ?? [];
            const musicItems = Array.isArray(dailySongs)
                ? dailySongs.map(formatNeteaseMusicItem).filter(Boolean) as IMusic.IMusicItem[]
                : [];
            if (musicItems.length) {
                recommendations.push({
                    key: "daily",
                    title: "网易云每日推荐",
                    count: musicItems.length,
                    musicItems,
                });
            }
        } else {
            console.log(
                "fetchNeteaseRecommendations daily error:",
                getHttpErrorSummary(dailyResult.reason),
            );
        }

        const personalFmResult = requestResults[1];
        if (personalFmResult.status === "fulfilled") {
            const personalFmSongs = personalFmResult.value?.data ?? [];
            const musicItems = Array.isArray(personalFmSongs)
                ? personalFmSongs.map(formatNeteaseMusicItem).filter(Boolean) as IMusic.IMusicItem[]
                : [];
            if (musicItems.length) {
                recommendations.push({
                    key: "personalFm",
                    title: "网易云私人漫游",
                    count: musicItems.length,
                    musicItems,
                });
            }
        } else {
            console.log(
                "fetchNeteaseRecommendations personal FM error:",
                getHttpErrorSummary(personalFmResult.reason),
            );
        }

        const privateRadarResult = requestResults[2];
        if (privateRadarResult.status === "fulfilled") {
            const resources = privateRadarResult.value?.recommend
                ?? privateRadarResult.value?.data
                ?? [];
            if (Array.isArray(resources) && resources.length) {
                const radarResource = resources.find((item: any) =>
                    /私人雷达|雷达/.test(`${item?.name ?? ""} ${item?.copywriter ?? ""}`),
                ) ?? resources[0];
                const playlistId = radarResource?.id;
                if (playlistId) {
                    recommendations.push({
                        key: "privateRadar",
                        title: "网易云私人雷达",
                        count: radarResource.trackCount ?? radarResource.trackNumberUpdateTime ?? 0,
                        playlistId: String(playlistId),
                        description: radarResource.name
                            ? `当前推荐歌单：${radarResource.name}`
                            : "当前推荐歌单",
                    });
                }
            }
        } else {
            console.log(
                "fetchNeteaseRecommendations private radar error:",
                getHttpErrorSummary(privateRadarResult.reason),
            );
        }

        if (!recommendations.length && requestResults.every((result) => result.status === "rejected")) {
            throw new Error(
                requestResults
                    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
                    .map((result) => getHttpErrorSummary(result.reason))
                    .join("; "),
            );
        }

        return recommendations;
    }

    TrayManager.setup(windowManager);
    WindowDrag.setup();
    shortCut.setup().then(voidCallback);
    logger.logPerf("Create Main Window");
    // Setup message bus & app state
    messageBus.onAppStateChange((_, patch) => {
        if ("musicItem" in patch) {
            TrayManager.buildTrayMenu();
            const musicItem = patch.musicItem;
            const mainWindow = windowManager.mainWindow;

            if (mainWindow) {
                const thumbStyle = AppConfig.getConfig("normal.taskbarThumb");
                if (process.platform === "win32" && thumbStyle === "artwork") {
                    ThumbBarUtil.setThumbImage(mainWindow, musicItem?.artwork);
                }
                if (musicItem) {
                    mainWindow.setTitle(
                        musicItem.title + (musicItem.artist ? ` - ${musicItem.artist}` : ""),
                    );
                } else {
                    mainWindow.setTitle(app.name);
                }
            }
        } else if ("playerState" in patch) {
            TrayManager.buildTrayMenu();
            const playerState = patch.playerState;

            if (process.platform === "win32") {
                ThumbBarUtil.setThumbBarButtons(windowManager.mainWindow, playerState === PlayerState.Playing);
            }
        } else if ("repeatMode" in patch) {
            TrayManager.buildTrayMenu();
        } else if ("lyricText" in patch && process.platform === "darwin") {
            if (AppConfig.getConfig("lyric.enableStatusBarLyric")) {
                TrayManager.setTitle(patch.lyricText);
            } else {
                TrayManager.setTitle("");
            }
        }
    });

    messageBus.setup(windowManager);

    // 上次关闭时处于迷你模式时，主窗口仍需在后台创建以维持播放器和状态同步，
    // 但不应与迷你窗口同时显示。
    if (AppConfig.getConfig("private.minimode")) {
        windowManager.prepareMainWindow();
    } else {
        windowManager.showMainWindow();
    }

    bootstrap();

});

async function bootstrap() {
    ServiceManager.setup(windowManager);

    const downloadPath = AppConfig.getConfig("download.path");
    if (!downloadPath) {
        AppConfig.setConfig({
            "download.path": app.getPath("downloads"),
        });
    }

    const minimodeEnabled = AppConfig.getConfig("private.minimode");

    if (minimodeEnabled) {
        windowManager.showMiniModeWindow();
    }

    /** 一些初始化设置 */
    // 初始化桌面歌词
    const desktopLyricEnabled = AppConfig.getConfig("lyric.enableDesktopLyric");

    if (desktopLyricEnabled) {
        windowManager.showLyricWindow();
    }

    AppConfig.onConfigUpdated((patch) => {
        // 桌面歌词锁定状态
        if ("lyric.lockLyric" in patch) {
            const lyricWindow = windowManager.lyricWindow;
            const lockState = patch["lyric.lockLyric"];

            if (!lyricWindow) {
                return;
            }
            if (lockState) {
                lyricWindow.setIgnoreMouseEvents(true, {
                    forward: true,
                });
            } else {
                lyricWindow.setIgnoreMouseEvents(false);
            }
        }
        if ("shortCut.enableGlobal" in patch) {
            const enableGlobal = patch["shortCut.enableGlobal"];
            if (enableGlobal) {
                shortCut.registerAllGlobalShortCuts();
            } else {
                shortCut.unregisterAllGlobalShortCuts();
            }
        }
    });


    // 初始化代理
    const proxyConfigKeys: Array<keyof IAppConfig> = [
        "network.proxy.enabled",
        "network.proxy.host",
        "network.proxy.port",
        "network.proxy.username",
        "network.proxy.password",
    ];

    AppConfig.onConfigUpdated((patch, config) => {
        let proxyUpdated = false;
        for (const proxyConfigKey of proxyConfigKeys) {
            if (proxyConfigKey in patch) {
                proxyUpdated = true;
                break;
            }
        }

        if (proxyUpdated) {
            if (config["network.proxy.enabled"]) {
                handleProxy(true, config["network.proxy.host"], config["network.proxy.port"], config["network.proxy.username"], config["network.proxy.password"]);
            } else {
                handleProxy(false);
            }
        }
    });

    handleProxy(
        AppConfig.getConfig("network.proxy.enabled"),
        AppConfig.getConfig("network.proxy.host"),
        AppConfig.getConfig("network.proxy.port"),
        AppConfig.getConfig("network.proxy.username"),
        AppConfig.getConfig("network.proxy.password"),
    );


}


function handleProxy(enabled: boolean, host?: string | null, port?: string | null, username?: string | null, password?: string | null) {
    try {
        if (!enabled) {
            axios.defaults.httpAgent = undefined;
            axios.defaults.httpsAgent = undefined;
        } else if (host) {
            const proxyUrl = new URL(host);
            proxyUrl.port = port;
            proxyUrl.username = username;
            proxyUrl.password = password;
            const agent = new HttpsProxyAgent(proxyUrl);

            axios.defaults.httpAgent = agent;
            axios.defaults.httpsAgent = agent;
        } else {
            throw new Error("Unknown Host");
        }
    } catch (e) {
        axios.defaults.httpAgent = undefined;
        axios.defaults.httpsAgent = undefined;
    }
}
