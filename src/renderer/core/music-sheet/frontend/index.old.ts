import Store from "@/common/store";
import * as backend from "../backend";
import defaultSheet from "../common/default-sheet";
import { useEffect, useRef, useState } from "react";
import { RequestStateCode, localPluginName } from "@/common/constant";
import { toMediaBase } from "@/common/media-util";

const musicSheetsStore = new Store<IMusic.IDBMusicSheetItem[]>([]);
const starredSheetsStore = new Store<IMedia.IMediaBase[]>([]);

export const useAllSheets = musicSheetsStore.useValue;
export const useAllStarredSheets = starredSheetsStore.useValue;

export const getAllSheets = musicSheetsStore.getValue;

/** 鏇存柊榛樿姝屽崟鍙樺寲 */
const refreshFavCbs = new Set<() => void>();
function refreshFavoriteState() {
    refreshFavCbs.forEach((cb) => cb?.());
}

/**
 * 鍒濆鍖? */
export async function setupMusicSheets() {
    const [musicSheets, starredSheets] = await Promise.all([
        backend.queryAllSheets(),
        backend.queryAllStarredSheets(),
    ]);
    musicSheetsStore.setValue(musicSheets);
    starredSheetsStore.setValue(starredSheets);
}

/**
 * 鏂板缓姝屽崟
 * @param sheetName 姝屽崟鍚? * @returns 鏂板缓鐨勬瓕鍗曚俊鎭? */
export async function addSheet(sheetName: string) {
    try {
        const newSheetDetail = await backend.addSheet(sheetName);
        musicSheetsStore.setValue(backend.getAllSheets());
        return newSheetDetail;
    } catch {}
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
        await backend.updateSheet(sheetId, newData);
        musicSheetsStore.setValue(backend.getAllSheets());
    } catch {}
}

/**
 * 鏇存柊姝屽崟涓殑姝屾洸椤哄簭
 * @param sheetId
 * @param musicList
 */

export async function updateSheetOrder(sheetIds: string[]) {
    try {
        await backend.updateSheetOrder(sheetIds);
        musicSheetsStore.setValue(backend.getAllSheets());
    } catch {}
}
export async function updateSheetMusicOrder(
    sheetId: string,
    musicList: IMusic.IMusicItem[],
) {
    try {
        const targetSheet = musicSheetsStore
            .getValue()
            .find((it) => it.id === sheetId);
        updateSheetDetail({
            ...targetSheet,
            musicList,
        });
        await backend.updateSheet(sheetId, {
            musicList: musicList.map(toMediaBase) as any,
        });
        musicSheetsStore.setValue(backend.getAllSheets());
    } catch {}
}

/**
 * 绉婚櫎姝屽崟
 * @param sheetId 姝屽崟ID
 * @returns 鍒犻櫎鍚庣殑ID
 */
export async function removeSheet(sheetId: string) {
    try {
        await backend.removeSheet(sheetId);
        musicSheetsStore.setValue(backend.getAllSheets());
    } catch {}
}

/**
 * 娓呯┖鎵€鏈夐煶涔? * @param sheetId 姝屽崟ID
 * @returns 鍒犻櫎鍚庣殑ID
 */
export async function clearSheet(sheetId: string) {
    try {
        await backend.clearSheet(sheetId);
        musicSheetsStore.setValue(backend.getAllSheets());
        refetchSheetDetail(sheetId);
    } catch {}
}

/**
 * 鏀惰棌姝屽崟
 * @param sheet
 */
export async function starMusicSheet(sheet: IMedia.IMediaBase) {
    await backend.starMusicSheet(sheet);
    starredSheetsStore.setValue(backend.getAllStarredSheets());
}

/**
 * 鍙栨秷鏀惰棌姝屽崟
 * @param sheet
 */
export async function unstarMusicSheet(sheet: IMedia.IMediaBase) {
    await backend.unstarMusicSheet(sheet);
    starredSheetsStore.setValue(backend.getAllStarredSheets());
}

/**
 * 鏀惰棌姝屽崟鎺掑簭
 */
export async function setStarredMusicSheets(sheets: IMedia.IMediaBase[]) {
    await backend.setStarredMusicSheets(sheets);
    starredSheetsStore.setValue(backend.getAllStarredSheets());
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
    const start = Date.now();
    await backend.addMusicToSheet(musicItems, sheetId);
    console.log("娣诲姞闊充箰", Date.now() - start, "ms");

    musicSheetsStore.setValue(backend.getAllSheets());
    if (sheetId === defaultSheet.id) {
        refreshFavoriteState();
    }
    refetchSheetDetail(sheetId);
}

/** 娣诲姞鍒伴粯璁ゆ瓕鍗?*/
export async function addMusicToFavorite(
    musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
) {
    return addMusicToSheet(musicItems, defaultSheet.id);
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
    const start = Date.now();
    await backend.removeMusicFromSheet(musicItems, sheetId);
    console.log("鍒犻櫎闊充箰", Date.now() - start, "ms");

    musicSheetsStore.setValue(backend.getAllSheets());
    if (sheetId === defaultSheet.id) {
        refreshFavoriteState();
    }
    refetchSheetDetail(sheetId);
}

/** 浠庨粯璁ゆ瓕鍗曚腑绉婚櫎 */
export async function removeMusicFromFavorite(
    musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
) {
    return removeMusicFromSheet(musicItems, defaultSheet.id);
}

/** 鏄惁鏄垜鍠滄鐨勬瓕鍗?*/
export function isFavoriteMusic(musicItem: IMusic.IMusicItem) {
    return backend.isFavoriteMusic(musicItem);
}

/** hook 鏌愰姝屾洸鏄惁琚爣璁版垚鍠滄 */
export function useMusicIsFavorite(musicItem: IMusic.IMusicItem) {
    const [isFav, setIsFav] = useState(backend.isFavoriteMusic(musicItem));

    useEffect(() => {
        const cb = () => {
            setIsFav(backend.isFavoriteMusic(musicItem));
        };
        cb();
        refreshFavCbs.add(cb);
        return () => {
            refreshFavCbs.delete(cb);
        };
    }, [musicItem]);

    return isFav;
}

const updateSheetDetailCallbacks: Map<
    string,
    Set<(newSheet: IMusic.IMusicSheetItem) => void>
> = new Map();

function updateSheetDetail(newSheet: IMusic.IMusicSheetItem) {
    updateSheetDetailCallbacks.get(newSheet?.id)?.forEach((cb) => cb?.(newSheet));
}

/**
 * 閲嶆柊鍙栨瓕鍗曠姸鎬? * @param sheetId
 */
async function refetchSheetDetail(sheetId: string) {
    let sheetDetail = await backend.getSheetItemDetail(sheetId);
    if (!sheetDetail) {
    // 鍙兘宸茬粡琚垹闄や簡
        sheetDetail = {
            id: sheetId,
            title: "已删除歌单",
            artist: "未知作者",
            platform: localPluginName,
        };
    }

    updateSheetDetail(sheetDetail);
}

/**
 * 鐩戝惉褰撳墠鏌愪釜姝屽崟
 * @param sheetId 姝屽崟ID
 * @param initQuery 鏄惁閲嶆柊鏌ヨ
 */
export function useMusicSheet(sheetId: string) {
    const [pendingState, setPendingState] = useState(
        RequestStateCode.PENDING_FIRST_PAGE,
    );
    const [sheetItem, setSheetItem] = useState<IMusic.IMusicSheetItem | null>(
        null,
    );

    // 瀹炴椂鐨剆heetId
    const realTimeSheetIdRef = useRef(sheetId);
    realTimeSheetIdRef.current = sheetId;

    const pendingStateRef = useRef(pendingState);
    pendingStateRef.current = pendingState;

    useEffect(() => {
        const updateSheet = async (newSheet: IMusic.IMusicSheetItem) => {
            // 濡傛灉鏇存柊鐨勬槸褰撳墠姝屽崟锛屽垯璁剧疆
            if (realTimeSheetIdRef.current === newSheet.id) {
                setSheetItem(newSheet);
                setPendingState(RequestStateCode.FINISHED);
            }
        };

        const cbs = updateSheetDetailCallbacks.get(sheetId) ?? new Set();
        cbs.add(updateSheet);
        updateSheetDetailCallbacks.set(sheetId, cbs);

        const targetSheet = musicSheetsStore
            .getValue()
            .find((item) => item.id === sheetId);

        if (targetSheet) {
            setSheetItem({
                ...targetSheet,
                musicList: [],
            });
        }

        setPendingState(RequestStateCode.PENDING_FIRST_PAGE);
        refetchSheetDetail(sheetId);

        return () => {
            cbs?.delete(updateSheet);
        };
    }, [sheetId]);

    return [sheetItem, pendingState] as const;
}

/**
 * 鐩戝惉褰撳墠鏌愪釜姝屽崟
 * @param sheetId 姝屽崟ID
 * @param initQuery 鏄惁閲嶆柊鏌ヨ
 */
// export function useMusicSheet(sheetId: string) {
//   const [pendingState, setPendingState] = useState(
//     RequestStateCode.PENDING_FIRST_PAGE
//   );
//   const [sheetItem, setSheetItem] = useState<IMusic.IMusicSheetItem | null>(
//     null
//   );

//   // 瀹炴椂鐨剆heetId
//   const realTimeSheetIdRef = useRef(sheetId);
//   realTimeSheetIdRef.current = sheetId;

//   const pendingStateRef = useRef(pendingState);
//   pendingStateRef.current = pendingState;

//   useEffect(() => {
//     const updateSheet = async () => {
//       const start = Date.now();
//       const sheetDetail = await backend.getSheetItemDetail(sheetId);
//       console.log("姝屽崟璇︽儏", Date.now() - start, "ms");
//       if (realTimeSheetIdRef.current === sheetId) {
//         console.log("姝屽崟璇︽儏", sheetId);
//         setSheetItem(sheetDetail);
//         setPendingState(RequestStateCode.FINISHED);
//       }
//     };

//     const updateSheetCallback = async () => {
//       if (!(pendingStateRef.current & RequestStateCode.LOADING)) {
//         setPendingState(RequestStateCode.PENDING_REST_PAGE);
//         await updateSheet();
//       }
//     };

//     const cbs = updateSheetCbs.get(sheetId) ?? new Set();
//     cbs.add(updateSheetCallback);
//     updateSheetCbs.set(sheetId, cbs);

//     const targetSheet = musicSheetsStore
//       .getValue()
//       .find((item) => item.id === sheetId);

//     if (targetSheet) {
//       setSheetItem({
//         ...targetSheet,
//         musicList: [],
//       });
//     }

//     setPendingState(RequestStateCode.PENDING_FIRST_PAGE);
//     updateSheet();

//     return () => {
//       cbs?.delete(updateSheetCallback);
//     };
//   }, [sheetId]);

//   return [sheetItem, pendingState] as const;
// }

export async function exportAllSheetDetails() {
    return await backend.exportAllSheetDetails();
}

