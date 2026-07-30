import {
  ColumnDef,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

import "./index.scss";
import Tag from "../Tag";
import { secondsToDuration } from "@/common/time-util";
import MusicSheet from "@/renderer/core/music-sheet";
import trackPlayer from "@renderer/core/track-player";
import Condition, { IfTruthy } from "../Condition";
import Empty from "../Empty";
import MusicDownloaded from "../MusicDownloaded";
import { localPluginName, RequestStateCode } from "@/common/constant";
import BottomLoadingState from "../BottomLoadingState";
import { IContextMenuItem, showContextMenu } from "../ContextMenu";
import {
  getInternalData,
  getMediaPrimaryKey,
  isSameMedia,
} from "@/common/media-util";
import {
  CSSProperties,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { showModal } from "../Modal";
import { showPanel } from "../Panel";
import useVirtualList from "@/hooks/useVirtualList";
import hotkeys from "hotkeys-js";
import Downloader from "@/renderer/core/downloader";
import { toast } from "react-toastify";
import SwitchCase from "../SwitchCase";
import SvgAsset from "../SvgAsset";
import musicSheetDB from "@/renderer/core/db/music-sheet-db";
import DragReceiver, { startDrag } from "../DragReceiver";
import { i18n } from "@/shared/i18n/renderer";
import isLocalMusic from "@/renderer/utils/is-local-music";
import AppConfig from "@shared/app-config/renderer";
import { shellUtil } from "@shared/utils/renderer";
import { useNavigate } from "react-router-dom";
import PluginManager from "@shared/plugin-manager/renderer";
import PlayingIndicator from "@/renderer/components/PlayingIndicator";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import albumImg from "@/assets/imgs/album-cover.jpg";

interface IMusicListProps {
  /** 展示的播放列表 */
  musicList: IMusic.IMusicItem[];
  /** 实际的播放列表 */
  getAllMusicItems?: () => IMusic.IMusicItem[];
  /** 音乐列表所属的歌单信息 */
  musicSheet?: IMusic.IMusicSheetItem;
  // enablePagination?: boolean; // 分页/虚拟长列表
  state?: RequestStateCode; // 网络状态
  doubleClickBehavior?: "replace" | "normal"; // 双击行为
  onPageChange?: (page?: number) => void; // 分页
  /** 虚拟滚动参数 */
  virtualProps?: {
    offsetHeight?: number | (() => number); // 距离顶部的高度
    getScrollElement?: () => HTMLElement; // 滚动
    fallbackRenderCount?: number;
  };
  containerStyle?: CSSProperties;
  hideRows?: Array<
    "like" | "index" | "title" | "artist" | "album" | "duration" | "platform"
  >;
  /** 允许拖拽 */
  enableDrag?: boolean;
  /** 拖拽结束 */
  onDragEnd?: (newMusicList: IMusic.IMusicItem[]) => void;
  /** context */
  contextMenu?: IContextMenuItem[];
  locateMusicItem?: IMusic.IMusicItem | null;
  locateRequestKey?: number;
}

const columnHelper = createColumnHelper<IMusic.IMusicItem>();

function firstValidValue(...values: any[]) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== "",
  );
}

function getArtistFromMusicItem(
  musicItem: IMusic.IMusicItem,
): IArtist.IArtistItem | null {
  if (!musicItem || musicItem.platform === localPluginName) {
    return null;
  }

  const raw = musicItem.$raw ?? musicItem.$ ?? {};
  const artistItem = firstValidValue(
    musicItem.artistItem,
    musicItem.artistInfo,
    raw.artistItem,
    raw.artistInfo,
  );
  const rawArtist = firstValidValue(
    raw.artist,
    raw.ar?.[0],
    raw.artists?.[0],
    raw.singers?.[0],
    raw.singer?.[0],
    musicItem.artists?.[0],
    musicItem.singers?.[0],
    musicItem.singer?.[0],
  );
  const artistId = firstValidValue(
    artistItem?.id,
    rawArtist?.id,
    musicItem.artistId,
    musicItem.artistid,
    musicItem.artistID,
    musicItem.singerId,
    musicItem.singerid,
    musicItem.singerID,
    musicItem.singerMID,
    musicItem.authorId,
    raw.artistId,
    raw.artistid,
    raw.artistID,
    raw.singerId,
    raw.singerid,
    raw.singerID,
    raw.singerMID,
    raw.authorId,
  );

  if (!artistId) {
    return null;
  }

  return {
    ...(artistItem ?? rawArtist ?? {}),
    id: `${artistId}`,
    name:
      firstValidValue(
        artistItem?.name,
        artistItem?.title,
        rawArtist?.name,
        rawArtist?.title,
        rawArtist?.singerName,
        musicItem.artist,
      ) ?? i18n.t("media.unknown_artist"),
    platform: musicItem.platform,
    avatar: firstValidValue(
      artistItem?.avatar,
      rawArtist?.avatar,
      rawArtist?.picUrl,
      rawArtist?.singerPic,
      "",
    ),
  } as IArtist.IArtistItem;
}

function getAlbumFromMusicItem(
  musicItem: IMusic.IMusicItem,
): IAlbum.IAlbumItem | null {
  if (!musicItem || musicItem.platform === localPluginName) {
    return null;
  }

  const raw = musicItem.$raw ?? musicItem.$ ?? {};
  const albumItem = firstValidValue(
    musicItem.albumItem,
    musicItem.albumInfo,
    raw.albumItem,
    raw.albumInfo,
  );
  const rawAlbum = firstValidValue(raw.album, raw.al, musicItem.al);
  const albumId = firstValidValue(
    albumItem?.id,
    rawAlbum?.id,
    musicItem.albumId,
    musicItem.albumid,
    musicItem.albumID,
    raw.albumId,
    raw.albumid,
    raw.albumID,
  );

  if (!albumId) {
    return null;
  }

  return {
    ...(albumItem ?? rawAlbum ?? {}),
    id: `${albumId}`,
    title:
      firstValidValue(
        albumItem?.title,
        albumItem?.name,
        rawAlbum?.title,
        rawAlbum?.name,
        musicItem.album,
      ) ?? i18n.t("media.unknown_album"),
    artist: firstValidValue(albumItem?.artist, musicItem.artist),
    artwork: firstValidValue(
      albumItem?.artwork,
      rawAlbum?.artwork,
      rawAlbum?.picUrl,
      musicItem.artwork,
    ),
    albumMID: firstValidValue(
      albumItem?.albumMID,
      musicItem.albumMID,
      musicItem.albummid,
      raw.albumMID,
      raw.albummid,
    ),
    albummid: firstValidValue(
      albumItem?.albummid,
      musicItem.albummid,
      raw.albummid,
    ),
    description: albumItem?.description ?? "",
    platform: musicItem.platform,
  } as IAlbum.IAlbumItem;
}

async function searchArtistFromMusicItem(musicItem: IMusic.IMusicItem) {
  const artistName = musicItem.artist?.trim();
  if (!artistName || musicItem.platform === localPluginName) {
    return null;
  }

  const result = (await PluginManager.callPluginDelegateMethod(
    musicItem,
    "search",
    artistName,
    1,
    "artist",
  )) as any;
  const artists = result?.data ?? [];
  const matched =
    artists.find((item: IArtist.IArtistItem) => item.name === artistName) ??
    artists[0];
  return matched
    ? ({
        ...matched,
        platform: matched.platform ?? musicItem.platform,
      } as IArtist.IArtistItem)
    : null;
}

async function searchAlbumFromMusicItem(musicItem: IMusic.IMusicItem) {
  const albumName = musicItem.album?.trim();
  if (!albumName || musicItem.platform === localPluginName) {
    return null;
  }

  const result = (await PluginManager.callPluginDelegateMethod(
    musicItem,
    "search",
    albumName,
    1,
    "album",
  )) as any;
  const albums = result?.data ?? [];
  const matched =
    albums.find(
      (item: IAlbum.IAlbumItem) =>
        item.title === albumName &&
        (!musicItem.artist ||
          !item.artist ||
          item.artist.includes(musicItem.artist) ||
          musicItem.artist.includes(item.artist)),
    ) ??
    albums.find((item: IAlbum.IAlbumItem) => item.title === albumName) ??
    albums[0];
  return matched
    ? ({
        ...matched,
        platform: matched.platform ?? musicItem.platform,
      } as IAlbum.IAlbumItem)
    : null;
}

function ArtistLinkCell(props: { musicItem: IMusic.IMusicItem }) {
  const { musicItem } = props;
  const artistName = musicItem.artist ?? i18n.t("media.unknown_artist");
  const artistItem = getArtistFromMusicItem(musicItem);
  const navigate = useNavigate();
  const canResolve =
    !!artistItem ||
    (musicItem.platform !== localPluginName &&
      !!artistName &&
      PluginManager.isSupportFeatureMethod(musicItem.platform, "search"));

  if (!canResolve) {
    return <span title={artistName}>{artistName}</span>;
  }

  return (
    <button
      type="button"
      className="music-list-media-link"
      title={artistName}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          const targetArtist =
            artistItem ?? (await searchArtistFromMusicItem(musicItem));
          if (!targetArtist) {
            toast.info(i18n.t("media.unknown_artist"));
            return;
          }
          navigate(
            `/main/artist/${encodeURIComponent(targetArtist.platform)}/${encodeURIComponent(targetArtist.id)}`,
            {
              state: {
                artistItem: targetArtist,
              },
            },
          );
        } catch {
          toast.info(i18n.t("media.unknown_artist"));
        }
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {artistName}
    </button>
  );
}

function getPlatformShortName(platform?: string) {
  if (!platform) {
    return "-";
  }
  if (platform.includes("\u7f51\u6613")) {
    return "W";
  }
  if (platform.toLocaleLowerCase().includes("qq")) {
    return "Q";
  }
  if (platform.includes("\u672c\u5730")) {
    return "B";
  }
  return platform.slice(0, 1).toLocaleUpperCase();
}

function MusicTitleCell(props: { musicItem: IMusic.IMusicItem }) {
  const { musicItem } = props;
  const title = musicItem?.title ?? "";

  return (
    <div className="music-list-title-cell">
      <span className="music-list-title-text" title={title}>{title}</span>
      <div
        className="music-list-hover-actions"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <MusicDownloaded musicItem={musicItem} size={18}></MusicDownloaded>
        <MusicLikeAction musicItem={musicItem}></MusicLikeAction>
        <MusicCollectAction musicItem={musicItem}></MusicCollectAction>
        <MusicCommentAction musicItem={musicItem}></MusicCommentAction>
      </div>
    </div>
  );
}

function MusicLikeAction(props: { musicItem: IMusic.IMusicItem }) {
  const { musicItem } = props;
  const sourceFav = MusicSheet.frontend.useMusicIsFavorite(musicItem);
  const [localFav, setLocalFav] = useState(sourceFav);

  useEffect(() => {
    setLocalFav(sourceFav);
  }, [sourceFav, musicItem]);

  const toggleFavorite = useCallback(async () => {
    const nextFav = !localFav;
    setLocalFav(nextFav);

    try {
      if (nextFav) {
        await MusicSheet.frontend.addMusicToFavorite(musicItem);
      } else {
        await MusicSheet.frontend.removeMusicFromFavorite(musicItem);
      }
    } catch {
      setLocalFav(!nextFav);
    }
  }, [localFav, musicItem]);

  return (
    <button
      type="button"
      className="music-list-hover-action music-list-like-action"
      title={localFav ? "\u53d6\u6d88\u559c\u6b22" : "\u559c\u6b22"}
      aria-label={localFav ? "\u53d6\u6d88\u559c\u6b22" : "\u559c\u6b22"}
      data-active={localFav}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <SvgAsset iconName={localFav ? "heart" : "heart-outline"} size={18}></SvgAsset>
    </button>
  );
}

function MusicCollectAction(props: { musicItem: IMusic.IMusicItem }) {
  const { musicItem } = props;

  return (
    <button
      type="button"
      className="music-list-hover-action music-list-collect-action"
      title="\u6536\u85cf\u5230\u6b4c\u5355"
      aria-label="\u6536\u85cf\u5230\u6b4c\u5355"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        showModal("AddMusicToSheet", {
          musicItems: [musicItem],
        });
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <SvgAsset iconName="document-plus" size={18}></SvgAsset>
    </button>
  );
}

function MusicCommentAction(props: { musicItem: IMusic.IMusicItem }) {
  const { musicItem } = props;
  const canComment = PluginManager.isSupportFeatureMethod(
    musicItem?.platform,
    "getMusicComments",
  );

  return (
    <button
      type="button"
      className="music-list-hover-action music-list-comment-action"
      title={canComment ? "\u67e5\u770b\u8bc4\u8bba" : "\u5f53\u524d\u5e73\u53f0\u6682\u4e0d\u652f\u6301\u8bc4\u8bba"}
      aria-label={canComment ? "\u67e5\u770b\u8bc4\u8bba" : "\u5f53\u524d\u5e73\u53f0\u6682\u4e0d\u652f\u6301\u8bc4\u8bba"}
      data-disabled={!canComment}
      disabled={!canComment}
      onClick={(e) => {
        e.stopPropagation();
        if (!canComment) {
          return;
        }
        showPanel("MusicComment", {
          musicItem,
          coverHeader: false,
        });
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <SvgAsset iconName="chat-bubble-left-ellipsis" size={18}></SvgAsset>
    </button>
  );
}

function AlbumLinkCell(props: { musicItem: IMusic.IMusicItem }) {
  const { musicItem } = props;
  const albumName = musicItem.album ?? i18n.t("media.unknown_album");
  const albumItem = getAlbumFromMusicItem(musicItem);
  const navigate = useNavigate();
  const canResolve =
    !!albumItem ||
    (musicItem.platform !== localPluginName &&
      !!albumName &&
      PluginManager.isSupportFeatureMethod(musicItem.platform, "search"));

  if (!canResolve) {
    return <span title={albumName}>{albumName}</span>;
  }

  return (
    <button
      type="button"
      className="music-list-media-link"
      title={albumName}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          const targetAlbum =
            albumItem ?? (await searchAlbumFromMusicItem(musicItem));
          if (!targetAlbum) {
            toast.info(i18n.t("media.unknown_album"));
            return;
          }
          navigate(
            `/main/album/${encodeURIComponent(targetAlbum.platform)}/${encodeURIComponent(targetAlbum.id)}`,
            {
              state: {
                albumItem: targetAlbum,
              },
            },
          );
        } catch {
          toast.info(i18n.t("media.unknown_album"));
        }
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {albumName}
    </button>
  );
}

const columnDef: ColumnDef<IMusic.IMusicItem>[] = [
  columnHelper.display({
    id: "like",
    size: 14,
    minSize: 14,
    maxSize: 14,
    cell: (info) => (
      <div className="music-list-operations">
        <div className="music-list-row-playing">
          <PlayingIndicator musicItem={info.row.original}></PlayingIndicator>
        </div>
      </div>
    ),
    enableResizing: false,
    enableSorting: false,
  }),
  columnHelper.accessor((_, index) => index + 1, {
    cell: (info) => info.getValue(),
    header: "#",
    id: "index",
    minSize: 28,
    maxSize: 28,
    size: 28,
    enableResizing: false,
  }),
  columnHelper.display({
    id: "artwork",
    header: "",
    size: 40,
    minSize: 40,
    maxSize: 40,
    cell: (info) => {
      const musicItem = info.row.original;
      return (
        <div className="music-list-artwork">
          <img
            src={musicItem.artwork ?? musicItem.coverImg ?? albumImg}
            alt=""
            draggable={false}
            onError={setFallbackAlbum}
          />
        </div>
      );
    },
    enableResizing: false,
    enableSorting: false,
  }),
  columnHelper.accessor("title", {
    header: () => i18n.t("media.media_title"),
    size: 320,
    maxSize: 500,
    minSize: 140,
    cell: (info) => (
      <MusicTitleCell musicItem={info.row.original}></MusicTitleCell>
    ),
    // @ts-ignore
    fr: 5,
  }),

  columnHelper.accessor("artist", {
    header: () => i18n.t("media.media_type_artist"),
    size: 100,
    maxSize: 150,
    minSize: 60,
    cell: (info) => (
      <ArtistLinkCell musicItem={info.row.original}></ArtistLinkCell>
    ),
    // @ts-ignore
    fr: 1.4,
  }),
  columnHelper.accessor("album", {
    header: () => i18n.t("media.media_type_album"),
    size: 100,
    maxSize: 150,
    minSize: 60,
    cell: (info) => (
      <AlbumLinkCell musicItem={info.row.original}></AlbumLinkCell>
    ),
    // @ts-ignore
    fr: 1.4,
  }),
  columnHelper.accessor("duration", {
    header: () => i18n.t("media.media_duration"),
    size: 56,
    maxSize: 120,
    minSize: 48,
    cell: (info) =>
      info.getValue() ? secondsToDuration(info.getValue()) : "--:--",
    // @ts-ignore
    fr: 0.8,
  }),
  columnHelper.accessor("platform", {
    header: () => i18n.t("media.media_platform"),
    size: 60,
    minSize: 56,
    maxSize: 90,
    cell: (info) => {
      const platform = info.getValue();
      return <Tag fill>{getPlatformShortName(platform)}</Tag>;
    },
    // @ts-ignore
    fr: 1,
  }),
];

const estimizeItemHeight = 3.25 * 13; // music list row height 3.25rem

export function showMusicContextMenu(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  x: number,
  y: number,
  sheetType?: string,
) {
  const menuItems: IContextMenuItem[] = [];
  const isArray = Array.isArray(musicItems);
  const singleMusicItem = isArray ? null : musicItems;
  if (!isArray) {
    menuItems.push(
      {
        title: `ID: ${getMediaPrimaryKey(musicItems)}`,
        icon: "identification",
      },
      {
        title: `${i18n.t("media.media_type_artist")}: ${
          musicItems.artist ?? i18n.t("media.unknown_artist")
        }`,
        icon: "user",
      },
      {
        title: `${i18n.t("media.media_type_album")}: ${
          musicItems.album ?? i18n.t("media.unknown_album")
        }`,
        icon: "album",
        show: !!musicItems.album,
      },
      {
        divider: true,
      },
    );
  }
  menuItems.push(
    {
      title: i18n.t("music_list_context_menu.next_play"),
      icon: "motion-play",
      onClick() {
        trackPlayer.addNext(musicItems);
      },
    },
    {
      title: i18n.t("music_list_context_menu.add_to_my_sheets"),
      icon: "document-plus",
      onClick() {
        showModal("AddMusicToSheet", {
          musicItems: musicItems,
        });
      },
    },
    {
      title: i18n.t("music_list_context_menu.remove_from_sheet"),
      icon: "trash",
      show: !!sheetType && sheetType !== "play-list",
      onClick() {
        MusicSheet.frontend.removeMusicFromSheet(musicItems, sheetType);
      },
    },
    {
      title: i18n.t("common.remove"),
      icon: "trash",
      show: sheetType === "play-list",
      onClick() {
        trackPlayer.removeMusic(musicItems);
      },
    },
    {
      title:
        singleMusicItem &&
        PluginManager.isSupportFeatureMethod(
          singleMusicItem.platform,
          "getMusicComments",
        )
          ? "查看评论"
          : "查看评论（当前平台暂不支持）",
      icon: "chat-bubble-left-ellipsis",
      show: !isArray,
      onClick() {
        if (!isArray) {
          showPanel("MusicComment", {
            musicItem: musicItems,
            coverHeader: false,
          });
        }
      },
    },
  );

  menuItems.push(
    {
      title: i18n.t("common.download"),
      icon: "array-download-tray",
      show: isArray
        ? !musicItems.every(
            (item) => isLocalMusic(item) || Downloader.isDownloaded(item),
          )
        : !isLocalMusic(musicItems) && !Downloader.isDownloaded(musicItems),
      onClick() {
        Downloader.startDownload(musicItems);
      },
    },
    {
      title: i18n.t("music_list_context_menu.delete_local_download"),
      icon: "trash",
      show:
        (isArray && musicItems.every((it) => Downloader.isDownloaded(it))) ||
        (!isArray && Downloader.isDownloaded(musicItems)),
      async onClick() {
        const [isSuccess, info] = await Downloader.removeDownloadedMusic(
          musicItems,
          true,
        );
        if (isSuccess) {
          if (isArray) {
            toast.success(
              i18n.t(
                "music_list_context_menu.delete_local_downloaded_songs_success",
                {
                  musicNums: musicItems.length,
                },
              ),
            );
          } else {
            toast.success(
              i18n.t(
                "music_list_context_menu.delete_local_downloaded_song_success",
                {
                  songName: (musicItems as IMusic.IMusicItem).title,
                },
              ),
            );
          }
        } else if (info?.msg) {
          toast.error(info.msg);
        }
      },
    },
    {
      title: i18n.t(
        "music_list_context_menu.reveal_local_music_in_file_explorer",
      ),
      icon: "folder-open",
      show:
        !isArray &&
        (Downloader.isDownloaded(musicItems) ||
          musicItems?.platform === localPluginName),
      async onClick() {
        try {
          if (!isArray) {
            let realTimeMusicItem = musicItems;
            if (musicItems.platform !== localPluginName) {
              realTimeMusicItem = await musicSheetDB.musicStore.get([
                musicItems.platform,
                musicItems.id,
              ]);
            }

            const downloadPath = getInternalData<IMusic.IMusicItemInternalData>(
              realTimeMusicItem,
              "downloadData",
            )?.path;

            const result = await shellUtil.showItemInFolder(downloadPath);
            if (!result) {
              throw new Error();
            }
          }
        } catch (e) {
          toast.error(
            `${i18n.t(
              "music_list_context_menu.reveal_local_music_in_file_explorer_fail",
            )} ${e?.message ?? ""}`,
          );
        }
      },
    },
  );

  showContextMenu({
    x,
    y,
    menuItems,
  });
}

function _MusicList(props: IMusicListProps) {
  const {
    musicList,
    state = RequestStateCode.FINISHED,
    onPageChange,
    musicSheet,
    virtualProps,
    // getAllMusicItems,
    doubleClickBehavior,
    containerStyle,
    hideRows,
    enableDrag,
    onDragEnd,
    locateMusicItem,
    locateRequestKey,
  } = props;

  const [sorting, setSorting] = useState<SortingState>([]);

  const musicListRef = useRef(musicList);
  const columnShownRef = useRef(
    AppConfig.getConfig("normal.musicListColumnsShown").reduce(
      (prev, curr) => ({
        ...prev,
        [curr]: false,
      }),
      {},
    ),
  );

  const table = useReactTable({
    debugAll: false,
    data: musicList,
    columns: columnDef,
    state: {
      sorting: sorting,
      columnVisibility: hideRows
        ? hideRows.reduce((prev, curr) => ({ ...prev, [curr]: false }), {
            ...columnShownRef.current,
          })
        : columnShownRef.current,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableContainerRef = useRef<HTMLDivElement>();
  const getVirtualOffsetHeight = useCallback(() => {
    const tableContainer = tableContainerRef.current;
    if (!tableContainer) {
      return 0;
    }

    const customOffsetHeight = virtualProps?.offsetHeight;
    if (typeof customOffsetHeight === "number") {
      return customOffsetHeight;
    }
    if (typeof customOffsetHeight === "function") {
      return customOffsetHeight();
    }

    const scrollElement = virtualProps?.getScrollElement?.();
    if (scrollElement) {
      const tableRect = tableContainer.getBoundingClientRect();
      const scrollRect = scrollElement.getBoundingClientRect();
      return scrollElement.scrollTop + tableRect.top - scrollRect.top;
    }

    return tableContainer.offsetTop ?? 0;
  }, [virtualProps]);

  const virtualController = useVirtualList({
    data: table.getRowModel().rows,
    getScrollElement: virtualProps?.getScrollElement,
    offsetHeight: getVirtualOffsetHeight,
    estimateItemHeight: estimizeItemHeight,
    fallbackRenderCount: !virtualProps?.getScrollElement
      ? -1
      : (virtualProps?.fallbackRenderCount ?? 50),
  });

  const [activeItems, setActiveItems] = useState<Set<number>>(new Set());
  const lastActiveIndexRef = useRef(0);

  useEffect(() => {
    if (!locateMusicItem || !locateRequestKey) {
      return;
    }
    const targetIndex = table
      .getRowModel()
      .rows.findIndex((row) => isSameMedia(row.original, locateMusicItem));
    if (targetIndex < 0) {
      return;
    }

    lastActiveIndexRef.current = targetIndex;
    setActiveItems(new Set([targetIndex]));
    virtualController.scrollToIndex(targetIndex, "smooth");
  }, [locateMusicItem, locateRequestKey, musicList]);

  useEffect(() => {
    setActiveItems(new Set());
    lastActiveIndexRef.current = 0;
    musicListRef.current = musicList;
  }, [musicList]);

  useEffect(() => {
    const ctrlAHandler = (evt: Event) => {
      evt.preventDefault();
      setActiveItems(
        new Set(
          Array.from({ length: musicListRef.current.length }, (_, i) => i),
        ),
      );
    };
    hotkeys("Ctrl+A", "music-list", ctrlAHandler);

    return () => {
      hotkeys.unbind("Ctrl+A", ctrlAHandler);
    };
  }, []);

  const _onDrop = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!onDragEnd || fromIndex === toIndex) {
        // 没有移动
        return;
      }
      const newData = musicList
        .slice(0, fromIndex)
        .concat(musicList.slice(fromIndex + 1));
      newData.splice(
        fromIndex > toIndex ? toIndex : toIndex - 1,
        0,
        musicList[fromIndex],
      );
      onDragEnd?.(newData);
    },
    [onDragEnd, musicList],
  );

  return (
    <div
      className="music-list-container"
      style={containerStyle}
      ref={tableContainerRef}
      tabIndex={-1}
      onFocus={() => {
        hotkeys.setScope("music-list");
      }}
      onBlur={() => {
        hotkeys.setScope("all");
      }}
    >
      <table
        style={{
          height: virtualController.totalHeight + estimizeItemHeight,
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr>
            {table.getHeaderGroups()[0].headers.map((header) => (
              <th
                key={header.id}
                data-id={header.id}
                style={{
                  //@ts-ignore
                  width: header.column.columnDef.fr
                    ? //@ts-ignore
                      `${header.column.columnDef.fr * 100}%`
                    : header.column.columnDef.size,
                }}
                onClick={header.column.getToggleSortingHandler()}
              >
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                )}
                <div
                  className="sort-container"
                  data-sorting={header.column.getIsSorted() !== false}
                >
                  <SwitchCase.Switch switch={header.column.getIsSorted()}>
                    <SwitchCase.Case case={"asc"}>
                      <SvgAsset iconName="sort-asc"></SvgAsset>
                    </SwitchCase.Case>
                    <SwitchCase.Case case={"desc"}>
                      <SvgAsset iconName="sort-desc"></SvgAsset>
                    </SwitchCase.Case>
                    <SwitchCase.Case case={false}>
                      <SvgAsset iconName="sort"></SvgAsset>
                    </SwitchCase.Case>
                  </SwitchCase.Switch>
                </div>
                {/* <div
                  onMouseDown={header.getResizeHandler()}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className={classNames({
                    resizer: true,
                    "resizer-resizing": header.column.getIsResizing(),
                  })}
                ></div> */}
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          style={{
            transform: `translateY(${virtualController.startTop}px)`,
          }}
        >
          {virtualController.virtualItems.map((virtualItem, index) => {
            const row = virtualItem.dataItem;

            if (!row.original) {
              return null;
            }
            // todo 拆出一个组件
            return (
              <tr
                key={row.id}
                data-active={activeItems.has(virtualItem.rowIndex)}
                onContextMenu={(e) => {
                  if (activeItems.size > 1) {
                    const selectedItems: IMusic.IMusicItem[] = [];
                    const rows = table.getRowModel().rows;
                    activeItems.forEach((item) => {
                      selectedItems.push(rows[item].original);
                    });

                    showMusicContextMenu(
                      selectedItems,
                      e.clientX,
                      e.clientY,
                      musicSheet?.platform === localPluginName
                        ? musicSheet.id
                        : undefined,
                    );
                  } else {
                    lastActiveIndexRef.current = virtualItem.rowIndex;
                    setActiveItems(new Set([virtualItem.rowIndex]));
                    showMusicContextMenu(
                      row.original,
                      e.clientX,
                      e.clientY,
                      musicSheet?.platform === localPluginName
                        ? musicSheet.id
                        : undefined,
                    );
                  }
                }}
                onClick={() => {
                  // 如果点击的时候按下shift
                  if (hotkeys.shift) {
                    let start = lastActiveIndexRef.current;
                    let end = virtualItem.rowIndex;

                    if (start >= end) {
                      [start, end] = [end, start];
                    }

                    if (end > musicListRef.current.length) {
                      end = musicListRef.current.length - 1;
                    }

                    setActiveItems(
                      new Set(
                        Array.from(
                          { length: end - start + 1 },
                          (_, i) => start + i,
                        ),
                      ),
                    );
                  } else if (hotkeys.ctrl) {
                    const newSet = new Set(activeItems);
                    if (newSet.has(virtualItem.rowIndex)) {
                      newSet.delete(virtualItem.rowIndex);
                    } else {
                      newSet.add(virtualItem.rowIndex);
                    }
                    setActiveItems(newSet);
                  } else {
                    setActiveItems(new Set([virtualItem.rowIndex]));
                    lastActiveIndexRef.current = virtualItem.rowIndex;
                  }
                }}
                onDoubleClick={() => {
                  const config =
                    doubleClickBehavior ??
                    AppConfig.getConfig("playMusic.clickMusicList");
                  if (config === "replace") {
                    trackPlayer.playMusicWithReplaceQueue(
                      table.getRowModel().rows.map((it) => it.original),
                      row.original,
                    );
                  } else {
                    trackPlayer.playMusic(row.original);
                  }
                }}
                draggable={enableDrag}
                onDragStart={(e) => {
                  // TODO
                  // if(activeItems) {

                  // }
                  startDrag(e, virtualItem.rowIndex, "musiclist");
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      //@ts-ignore
                      width: cell.column.columnDef.fr
                        ? //@ts-ignore
                          `${cell.column.columnDef.fr * 100}%`
                        : cell.column.columnDef.size,
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                <IfTruthy condition={enableDrag}>
                  <IfTruthy condition={index === 0}>
                    <DragReceiver
                      position="top"
                      rowIndex={virtualItem.rowIndex}
                      onDrop={_onDrop}
                      tag="musiclist"
                      insideTable
                    ></DragReceiver>
                  </IfTruthy>
                  <DragReceiver
                    position="bottom"
                    rowIndex={virtualItem.rowIndex + 1}
                    onDrop={_onDrop}
                    tag="musiclist"
                    insideTable
                  ></DragReceiver>
                </IfTruthy>
              </tr>
            );
          })}
        </tbody>
        <tfoot
          style={{
            height:
              virtualController.totalHeight -
              virtualController.virtualItems.length * estimizeItemHeight,
          }}
        ></tfoot>
      </table>
      <Condition
        condition={musicList.length === 0}
        falsy={
          <BottomLoadingState
            state={state}
            onLoadMore={onPageChange}
          ></BottomLoadingState>
        }
      >
        <Empty></Empty>
      </Condition>
    </div>
  );
}

export default memo(
  _MusicList,
  (prev, curr) =>
    prev.state === curr.state &&
    prev.enableDrag === curr.enableDrag &&
    prev.musicList === curr.musicList &&
    prev.onPageChange === curr.onPageChange &&
    prev.onDragEnd === curr.onDragEnd &&
    prev.locateMusicItem === curr.locateMusicItem &&
    prev.locateRequestKey === curr.locateRequestKey &&
    prev.musicSheet &&
    curr.musicSheet &&
    isSameMedia(prev.musicSheet, curr.musicSheet),
);
