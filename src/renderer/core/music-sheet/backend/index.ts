/**
 * 杩欓噷涓嶅簲璇ュ啓浠讳綍鍜孶I鏈夊叧鐨勯€昏緫锛屽彧鏄畝鍗曠殑鏁版嵁搴撴搷浣? *
 * 闄や簡frontend鏂囦欢澶瑰锛屽叾浠栦换浣曞湴鏂逛笉搴旇鐩存帴璋冪敤姝ゅ瀹氫箟鐨勫嚱鏁? */

import { localPluginName, musicRefSymbol, sortIndexSymbol, timeStampSymbol } from "@/common/constant";
import { nanoid } from "nanoid";
import musicSheetDB from "../../db/music-sheet-db";
import { produce } from "immer";
import defaultSheet from "../common/default-sheet";
import { getMediaPrimaryKey, isSameMedia } from "@/common/media-util";
import { getUserPreferenceIDB, setUserPreferenceIDB } from "@/renderer/utils/user-perference";

/******************** 鍐呭瓨缂撳瓨 ***********************/
// 榛樿姝屵崟锛屽揩閫熷垽瀹氭槸鍚﹀湪鍒楄〃涓
const favoriteMusicListIds = new Set<string>();
// 鍏ㄩ儴鐨勬瓕鍗曞垪琛?鏃犺鎯咃紝鍙湁ID)
let musicSheets: IMusic.IDBMusicSheetItem[] = [];
// 鏄熸爣鐨勬瓕鍗曚俊鎭
let starredMusicSheets: IMedia.IMediaBase[] = [];

/******************** 鏂规硶 ***********************/

/**
 * 鑾峰彇鍏ㄩ儴闊充箰淇℃伅
 * @returns
 */
export function getAllSheets() {
    return musicSheets;
}

export function getAllStarredSheets() {
    return starredMusicSheets;
}

/**
 *
 * 鏌ヨ鎵€鏈夋瓕鍗曚俊鎭紙鏃犺鎯咃級
 *
 * @returns 鍏ㄩ儴姝屽崟淇℃伅
 */
export async function queryAllSheets() {
    try {
        // 璇诲彇鍏ㄩ儴姝屽崟
        const allSheets = await musicSheetDB.sheets
            .orderBy("$$sortIndex")
            .toArray();
        favoriteMusicListIds.clear();

        const defaultSheetIndex = allSheets.findIndex(item => item.id === defaultSheet.id);

        if (allSheets.length === 0 || defaultSheetIndex === -1) {
            await musicSheetDB.transaction(
                "readwrite",
                musicSheetDB.sheets,
                async () => {
                    musicSheetDB.sheets.put(defaultSheet);
                },
            );
            musicSheets = [defaultSheet, ...allSheets];
        } else {
            const dbDefaultSheet = allSheets.find(
                (item) => item.id === defaultSheet.id,
            );
            dbDefaultSheet.musicList.forEach((mi) => {
                favoriteMusicListIds.add(getMediaPrimaryKey(mi));
            });
            musicSheets = allSheets;

            if (defaultSheetIndex !== 0) {
                allSheets.splice(defaultSheetIndex, 1);
                allSheets.unshift(dbDefaultSheet);
            }
        }

        // 鏀惰棌姝屽崟
        return musicSheets;
    } catch (e) {
        console.log(e);
        return musicSheets;
    }
}

/**
 * 鏌ヨ鎵€鏈夋敹钘忔瓕鍗? * @returns 鏀惰棌姝屽崟淇℃伅
 */
export async function queryAllStarredSheets() {
    try {
        starredMusicSheets =
            (await getUserPreferenceIDB("starredMusicSheets")) || [];
        return starredMusicSheets;
    } catch {
        return [];
    }
}

/**
 * 鏂板缓姝屽崟
 * @param sheetName 姝屽崟鍚? * @returns 鏂板缓鐨勬瓕鍗曚俊鎭? */
export async function addSheet(sheetName: string) {
    const id = nanoid();
    const newSheet: IMusic.IMusicSheetItem = {
        id,
        title: sheetName,
        createAt: Date.now(),
        platform: localPluginName,
        musicList: [],
        $$sortIndex: musicSheets[musicSheets.length - 1].$$sortIndex + 1,
    };
    try {
        await musicSheetDB.transaction(
            "readwrite",
            musicSheetDB.sheets,
            async () => {
                musicSheetDB.sheets.put(newSheet);
            },
        );
        musicSheets = [...musicSheets, newSheet];
        return newSheet;
    } catch {
        throw new Error("鏂板缓澶辫触");
    }
}

/**
 * 鏇存柊姝屽崟淇℃伅
 * @param sheetId 姝屽崟ID
 * @param newData 鏈€鏂扮殑姝屽崟淇℃伅
 * @returns
 */
export async function updateSheet(
    sheetId: string,
    newData: Partial<IMusic.IMusicSheetItem>,
) {
    try {
        if (!newData) {
            return;
        }
        await musicSheetDB.transaction(
            "readwrite",
            musicSheetDB.sheets,
            async () => {
                musicSheetDB.sheets.update(sheetId, newData);
            },
        );

        musicSheets = produce(musicSheets, (draft) => {
            const currentIndex = draft.findIndex((_) => _.id === sheetId);
            if (currentIndex === -1) {
                draft.push(newData as IMusic.IDBMusicSheetItem);
            } else {
                draft[currentIndex] = {
                    ...draft[currentIndex],
                    ...newData,
                };
            }
        });
    } catch (e) {
        // 鏇存柊姝屽崟淇℃伅澶辫触
        console.log(e);
    }
}

/**
 * 绉婚櫎姝屽崟
 * @param sheetId 姝屽崟ID
 * @returns 鍒犻櫎鍚庣殑ID
 */

export async function updateSheetOrder(sheetIds: string[]) {
    try {
        if (!sheetIds?.length) {
            return;
        }

        const sheetIdSet = new Set(sheetIds);
        const orderedSheets = sheetIds
            .map((sheetId) => musicSheets.find((sheet) => sheet.id === sheetId))
            .filter(Boolean) as IMusic.IDBMusicSheetItem[];
        const restSheets = musicSheets.filter((sheet) => !sheetIdSet.has(sheet.id));
        const nextSheets = [...orderedSheets, ...restSheets].map((sheet, index) => ({
            ...sheet,
            $$sortIndex: index,
        }));

        await musicSheetDB.transaction(
            "readwrite",
            musicSheetDB.sheets,
            async () => {
                await musicSheetDB.sheets.bulkPut(nextSheets);
            },
        );

        musicSheets = nextSheets;
    } catch (e) {
        console.log(e);
    }
}
export async function removeSheet(sheetId: string) {
    try {
        if (sheetId === defaultSheet.id) {
            // 榛樿姝屽崟涓嶅彲鍒犻櫎
            return;
        }
        await musicSheetDB.transaction(
            "readwrite",
            musicSheetDB.sheets,
            musicSheetDB.musicStore,
            async () => {
                const targetSheet = musicSheets.find((item) => item.id === sheetId);

                await removeMusicFromSheet(
                    targetSheet.musicList ?? ([] as any),
                    sheetId,
                );
                musicSheetDB.sheets.delete(sheetId);
            },
        );
        musicSheets = musicSheets.filter((it) => it.id !== sheetId);
        return musicSheets;
    } catch (e) {
        console.log(e);
    }
}

/**
 * 娓呯┖鎵€鏈夐煶涔? * @param sheetId 姝屽崟ID
 * @returns 鍒犻櫎鍚庣殑ID
 */
export async function clearSheet(sheetId: string) {
    try {
        await musicSheetDB.transaction(
            "readwrite",
            musicSheetDB.sheets,
            musicSheetDB.musicStore,
            async () => {
                const targetSheet = musicSheets.find((item) => item.id === sheetId);
                await removeMusicFromSheet(
                    targetSheet.musicList ?? ([] as any),
                    sheetId,
                );
                targetSheet.musicList = [];
            },
        );
        return [...musicSheets];
    } catch (e) {
        console.log(e);
    }
}

/**
 * 鏀惰棌姝屽崟
 * @param sheet
 */
export async function starMusicSheet(sheet: IMedia.IMediaBase) {
    const newSheets = [...starredMusicSheets, sheet];
    await setUserPreferenceIDB("starredMusicSheets", newSheets);
    starredMusicSheets = newSheets;
}

/**
 * 鍙栨秷鏀惰棌姝屽崟
 * @param sheet
 */
export async function unstarMusicSheet(sheet: IMedia.IMediaBase) {
    const newSheets = starredMusicSheets.filter(
        (item) => !isSameMedia(item, sheet),
    );
    await setUserPreferenceIDB("starredMusicSheets", newSheets);
    starredMusicSheets = newSheets;
}

/**
 * 鏀惰棌姝屽崟鎺掑簭
 */

export async function setStarredMusicSheets(sheets: IMedia.IMediaBase[]) {
    await setUserPreferenceIDB("starredMusicSheets", sheets);
    starredMusicSheets = sheets;
}

/**************************** 姝屾洸鐩稿叧鏂规硶 ************************/

/**
 * 娣诲姞姝屾洸鍒版瓕鍗? * @param musicItems
 * @param sheetId
 * @returns
 */
export async function addMusicToSheet(
    musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
    sheetId: string,
) {
    const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
    try {
        // 褰撳墠鐨勫垪琛
        const targetSheet = musicSheets.find((item) => item.id === sheetId);
        if (!targetSheet) {
            return;
        }
        // 绛涢€夊嚭涓嶅湪鍒楄〃涓殑椤圭洰
        const targetMusicList = targetSheet.musicList;
        // 瑕佹坊鍔犲埌闊充箰鍒楄〃涓殑椤圭洰
        const validMusicItems = _musicItems.filter(
            (item) => -1 === targetMusicList.findIndex((mi) => isSameMedia(mi, item)),
        );

        await musicSheetDB.transaction(
            "rw",
            musicSheetDB.musicStore,
            musicSheetDB.sheets,
            async () => {
                // 瀵绘壘宸插叆搴撶殑闊充箰椤圭洰
                const allMusic = await musicSheetDB.musicStore.bulkGet(
                    validMusicItems.map((item) => [item.platform, item.id]),
                );
                allMusic.forEach((mi, index) => {
                    if (mi) {
                        mi[musicRefSymbol] += 1;
                    } else {
                        allMusic[index] = {
                            ...validMusicItems[index],
                            [musicRefSymbol]: 1,
                        };
                    }
                });
                await musicSheetDB.musicStore.bulkPut(allMusic);
                const timeStamp = Date.now();
                await musicSheetDB.sheets
                    .where("id")
                    .equals(sheetId)
                    .modify((obj) => {
                        obj.artwork =
                            validMusicItems[validMusicItems.length - 1]?.artwork ??
                            obj.artwork;
                        obj.musicList = [
                            ...(obj.musicList ?? []),
                            ...validMusicItems.map((item, index) => ({
                                platform: item.platform,
                                id: item.id,
                                [sortIndexSymbol]: index,
                                [timeStampSymbol]: timeStamp,
                            })),
                        ];
                        targetSheet.artwork = obj.artwork;
                        targetSheet.musicList = obj.musicList;
                        musicSheets = [...musicSheets];
                    });
            },
        );

        if (sheetId === defaultSheet.id) {
            _musicItems.forEach((mi) => {
                favoriteMusicListIds.add(getMediaPrimaryKey(mi));
            });
        }

        return musicSheets;
    } catch {
        console.log("error!!");
    }
}

/**
 * 浠庢瓕鍗曞唴绉婚櫎姝屾洸
 * @param musicItems 瑕佺Щ闄ょ殑姝屾洸
 * @param sheetId 姝屽崟ID
 * @returns
 */
export async function removeMusicFromSheet(
    musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
    sheetId: string,
) {
    const targetSheet = musicSheets.find((item) => item.id === sheetId);
    if (!targetSheet) {
        return;
    }
    // 閲嶆柊缁勮
    const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
    const targetMusicList = targetSheet.musicList ?? [];
    const toBeRemovedMusic: IMedia.IMediaBase[] = [];
    const restMusic: IMedia.IMediaBase[] = [];
    for (const mi of targetMusicList) {
        // use map may be faster, keep this loop explicit for readability
        if (_musicItems.findIndex((item) => isSameMedia(mi, item)) === -1) {
            restMusic.push(mi);
        } else {
            toBeRemovedMusic.push(mi);
        }
    }

    try {
        await musicSheetDB.transaction(
            "rw",
            musicSheetDB.sheets,
            musicSheetDB.musicStore,
            async () => {
                // 瀵绘壘寮曠敤
                const toBeRemovedMusicDetail = await musicSheetDB.musicStore.bulkGet(
                    toBeRemovedMusic.map((item) => [item.platform, item.id]),
                );
                // 濡傛灉寮曠敤璁℃暟涓?锛岃繘鍏ュ垹闄ら槦鍒
                const needDelete: any[] = [];
                // 濡傛灉涓嶄负0锛岃繘鍏ユ洿鏂伴槦鍒
                const needUpdate: any[] = [];
                toBeRemovedMusicDetail.forEach((musicItem) => {
                    if (!musicItem) {
                        return;
                    }
                    musicItem[musicRefSymbol]--;
                    if (musicItem[musicRefSymbol] === 0) {
                        needDelete.push([musicItem.platform, musicItem.id]);
                    } else {
                        needUpdate.push(musicItem);
                    }
                });
                await musicSheetDB.musicStore.bulkDelete(needDelete);
                await musicSheetDB.musicStore.bulkPut(needUpdate);

                // 褰撳墠鐨勬渶鍚庝竴棣栨瓕
                const lastMusic = restMusic[restMusic.length - 1];
                // 鏇存柊褰撳墠姝屽崟鐨勫皝闈
                let newArtwork: string;
                if (lastMusic) {
                    newArtwork = (
                        await musicSheetDB.musicStore.get([
                            lastMusic.platform,
                            lastMusic.id,
                        ])
                    ).artwork;
                }

                await musicSheetDB.sheets
                    .where("id")
                    .equals(sheetId)
                    .modify((obj) => {
                        obj.artwork = newArtwork;
                        obj.musicList = restMusic;
                        // 淇敼 MusicSheets
                        targetSheet.artwork = newArtwork;
                        targetSheet.musicList = obj.musicList;
                        musicSheets = [...musicSheets];
                    });
            },
        );

        if (sheetId === defaultSheet.id) {
            // 浠庨粯璁ゆ瓕鍗曢噷鍒犻櫎
            _musicItems.forEach((mi) => {
                favoriteMusicListIds.delete(getMediaPrimaryKey(mi));
            });
        }
    } catch (e) {
        console.log(e);
        throw e;
    }
}

/** 鑾峰彇姝屽崟鍐呯殑姝屾洸璇︾粏淇℃伅 */
export async function getSheetItemDetail(
    sheetId: string,
): Promise<IMusic.IMusicSheetItem | null> {
    // 鍙栧お澶氭瓕鏇叉椂浼氬崱椤匡紝 1000棣栨瓕澶х害100ms
    const targetSheet = musicSheets.find((item) => item.id === sheetId);
    if (!targetSheet) {
        return null;
    }
    const tmpResult = [];
    const musicList = targetSheet.musicList ?? [];
    // 涓€缁?00涓
    const groupSize = 800;
    const groupNum = Math.ceil(musicList.length / groupSize);

    for (let i = 0; i < groupNum; ++i) {
        const sliceResult = await musicSheetDB.transaction(
            "readonly",
            musicSheetDB.musicStore,
            async () => {
                return await musicSheetDB.musicStore.bulkGet(
                    musicList
                        .slice(i * groupSize, (i + 1) * groupSize)
                        .map((item) => [item.platform, item.id]),
                );
            },
        );

        tmpResult.push(...(sliceResult ?? []));
    }

    return {
        ...targetSheet,
        musicList: tmpResult,
    } as IMusic.IMusicSheetItem;
}

/**
 * 鏌愰姝屾槸鍚﹁鏍囪涓哄枩娆? * @param musicItem
 * @returns
 */
export function isFavoriteMusic(musicItem: IMusic.IMusicItem) {
    return favoriteMusicListIds.has(getMediaPrimaryKey(musicItem));
}

/** 瀵煎嚭鎵€鏈夋瓕鍗曚俊鎭?*/
export async function exportAllSheetDetails() {
    return await musicSheetDB.transaction(
        "readonly",
        musicSheetDB.musicStore,
        async () => {
            const allSheets = musicSheets;
            if (!allSheets) {
                return [];
            }
            const musicLists = await Promise.all(
                allSheets.map((sheet) =>
                    musicSheetDB.musicStore.bulkGet(
                        (sheet.musicList ?? []).map((item) => [item.platform, item.id]),
                    ),
                ),
            );

            const allSheetDetails = produce(allSheets, (draft) => {
                draft.forEach((sheet, index) => {
                    sheet.musicList = musicLists[index];
                });
            });

            return allSheetDetails;
        },
    );
}

