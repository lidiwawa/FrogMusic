import MusicSheet from "@/renderer/core/music-sheet";
import PluginManager from "@shared/plugin-manager/renderer";

export type NeteaseRecommendationKey = "daily" | "privateRadar" | "personalFm";

type NeteaseRecommendationItem = {
    key: NeteaseRecommendationKey;
    title: string;
    count: number;
    musicItems?: IMusic.IMusicItem[];
    playlistId?: string;
    description?: string;
};

const CACHE_TTL = 2 * 60 * 1000;
const legacySheetTitles = [
    "网易云每日推荐",
    "网易云私人雷达",
    "网易云私人漫游",
];

let cachedRecommendations: NeteaseRecommendationItem[] | null = null;
let cachedAt = 0;
let pendingRequest: Promise<NeteaseRecommendationItem[]> | null = null;

function getNeteasePlugin() {
    return PluginManager.getSortedSupportedPlugin("importMusicSheet").find(
        (plugin) =>
            plugin.platform?.includes("网易云") ||
            plugin.platform?.toLowerCase().includes("netease"),
    );
}

export async function refreshNeteaseRecommendations(force = false) {
    if (
        !force &&
        cachedRecommendations &&
        Date.now() - cachedAt < CACHE_TTL
    ) {
        return cachedRecommendations;
    }

    if (pendingRequest) {
        return pendingRequest;
    }

    pendingRequest = PluginManager.getNeteaseRecommendations()
        .then((result) => {
            if (!result.success) {
                throw new Error(result.reason ?? "获取网易云推荐失败");
            }

            cachedRecommendations = (result.recommendations ?? []) as NeteaseRecommendationItem[];
            cachedAt = Date.now();
            return cachedRecommendations;
        })
        .finally(() => {
            pendingRequest = null;
        });

    return pendingRequest;
}

export async function fetchNeteaseRecommendationQueue(
    key: NeteaseRecommendationKey,
    force = false,
) {
    const recommendations = await refreshNeteaseRecommendations(force);
    const recommendation = recommendations.find((item) => item.key === key);
    if (!recommendation) {
        throw new Error("未获取到推荐内容");
    }

    let musicItems = recommendation.musicItems?.filter(Boolean) ?? [];
    if (!musicItems.length && recommendation.playlistId) {
        const plugin = getNeteasePlugin();
        if (!plugin) {
            throw new Error("未找到网易云插件");
        }
        const importedItems = (await PluginManager.callPluginDelegateMethod(
            plugin,
            "importMusicSheet",
            recommendation.playlistId,
        )) as IMusic.IMusicItem[] | null;
        musicItems = Array.isArray(importedItems)
            ? importedItems.filter(Boolean)
            : [];
    }

    if (!musicItems.length) {
        throw new Error("未获取到推荐歌曲");
    }

    return musicItems;
}

export async function removeLegacyNeteaseRecommendationSheets() {
    await MusicSheet.frontend.setupMusicSheets();
    const legacySheets = MusicSheet.frontend
        .getAllSheets()
        .filter((sheet) => legacySheetTitles.includes(sheet.title));

    await Promise.all(
        legacySheets.map((sheet) => MusicSheet.frontend.removeSheet(sheet.id)),
    );
}
