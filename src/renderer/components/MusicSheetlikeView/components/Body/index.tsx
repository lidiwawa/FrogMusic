import MusicList from "@/renderer/components/MusicList";
import "./index.scss";
import SvgAsset from "@/renderer/components/SvgAsset";
import { ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import Condition from "@/renderer/components/Condition";
import Loading from "@/renderer/components/Loading";
import trackPlayer from "@renderer/core/track-player";
import { showModal } from "@/renderer/components/Modal";
import { RequestStateCode, localPluginName } from "@/common/constant";
import MusicSheet from "@/renderer/core/music-sheet";
import AppConfig from "@shared/app-config/renderer";
import { useTranslation } from "react-i18next";
import Downloader from "@/renderer/core/downloader";
import PluginManager from "@shared/plugin-manager/renderer";
import { toast } from "react-toastify";
import { isSameMedia } from "@/common/media-util";

interface IProps {
    musicSheet: IMusic.IMusicSheetItem;
    musicList: IMusic.IMusicItem[];
    state?: RequestStateCode;
    onLoadMore?: () => void;
    options?: ReactNode;
}
export default function Body(props: IProps) {
    const { musicList = [], musicSheet, state, onLoadMore, options } = props;

    const [inputSearch, setInputSearch] = useState("");
    const [filterMusicList, setFilterMusicList] = useState<
    IMusic.IMusicItem[] | null
    >(null);
    const [locateMusicItem, setLocateMusicItem] =
        useState<IMusic.IMusicItem | null>(null);
    const [locateRequestKey, setLocateRequestKey] = useState(0);
    const [isPending, startTransition] = useTransition();
    const { t } = useTranslation();
    const downloadedMusicList = Downloader.useDownloadedMusicList();
    const visibleMusicList = filterMusicList ?? musicList;
    const isFiltering = inputSearch.trim().length > 0;
    const downloadableMusicList = useMemo(() => {
        return visibleMusicList.filter((item) =>
            item?.platform !== localPluginName &&
            !Downloader.isDownloaded(item) &&
            PluginManager.isSupportFeatureMethod(item?.platform, "getMediaSource"),
        );
    }, [visibleMusicList, downloadedMusicList]);

    useEffect(() => {
        if (inputSearch.trim() === "") {
            setFilterMusicList(null);
        } else {
            startTransition(() => {
                const caseSensitive = AppConfig.getConfig(
                    "playMusic.caseSensitiveInSearch",
                );
                if (caseSensitive) {
                    setFilterMusicList(
                        musicList.filter(
                            (item) =>
                                item.title?.includes(inputSearch) ||
                item.artist?.includes(inputSearch) ||
                item.album?.includes(inputSearch),
                        ),
                    );
                } else {
                    const searchText = inputSearch.toLocaleLowerCase();
                    setFilterMusicList(
                        musicList.filter(
                            (item) =>
                                item.title?.toLocaleLowerCase()?.includes(searchText) ||
                item.artist?.toLocaleLowerCase()?.includes(searchText) ||
                item.album?.toLocaleLowerCase()?.includes(searchText),
                        ),
                    );
                }
            });
        }
    }, [inputSearch]);

    useEffect(() => {
        setInputSearch("");
    }, [musicSheet?.id]);

    const handleLocateCurrentMusic = () => {
        const currentMusic = trackPlayer.currentMusic;
        if (!currentMusic) {
            toast.info("当前没有正在播放的歌曲");
            return;
        }
        const target = musicList.find((item) => isSameMedia(item, currentMusic));
        if (!target) {
            toast.info("当前播放歌曲不在这个歌单里");
            return;
        }
        if (inputSearch.trim()) {
            setInputSearch("");
            setFilterMusicList(null);
        }
        setLocateMusicItem(target);
        setLocateRequestKey(Date.now());
    };

    return (
        <div className="music-sheetlike-view--body-container">
            <div className="operations">
                <div className="buttons">
                    <div
                        role="button"
                        className="option-button"
                        data-disabled={!visibleMusicList?.length}
                        data-type="primaryButton"
                        title={isFiltering ? "播放搜索结果" : t("music_sheet_like_view.play_all")}
                        onClick={() => {
                            if (visibleMusicList.length) {
                                trackPlayer.playMusicWithReplaceQueue(visibleMusicList);
                            }
                        }}
                    >
                        <SvgAsset iconName="play"></SvgAsset>
                        <span>{isFiltering ? "播放结果" : t("music_sheet_like_view.play_all")}</span>
                    </div>
                    <div
                        role="button"
                        data-type="normalButton"
                        data-disabled={!visibleMusicList?.length}
                        className="add-to-sheet option-button"
                        title={isFiltering ? "添加搜索结果到歌单" : t("music_sheet_like_view.add_to_sheet")}
                        onClick={() => {
                            showModal("AddMusicToSheet", {
                                musicItems: visibleMusicList,
                            });
                        }}
                    >
                        <SvgAsset iconName="plus"></SvgAsset>
                        <span>{isFiltering ? "添加结果" : t("music_sheet_like_view.add_to_sheet")}</span>
                    </div>
                    <div
                        role="button"
                        data-type="normalButton"
                        data-disabled={!downloadableMusicList.length}
                        className="download-sheet option-button"
                        title={
                            downloadableMusicList.length
                                ? `下载 ${downloadableMusicList.length} 首可用歌曲${isFiltering ? "（搜索结果）" : ""}`
                                : "当前歌单没有可下载歌曲"
                        }
                        onClick={() => {
                            if (!downloadableMusicList.length) {
                                return;
                            }
                            Downloader.startDownload(downloadableMusicList);
                            toast.info(`已加入下载队列：${downloadableMusicList.length} 首`);
                        }}
                    >
                        <SvgAsset iconName="array-download-tray"></SvgAsset>
                        <span>{isFiltering ? "下载结果" : "下载可用"}</span>
                    </div>
                    <Condition condition={musicSheet?.platform === localPluginName}>
                        <div
                            role="button"
                            data-type="normalButton"
                            className="edit-sheet option-button"
                            title="编辑歌单信息"
                            onClick={() => {
                                showModal("EditMusicSheet", {
                                    musicSheet,
                                });
                            }}
                        >
                            <SvgAsset iconName="pencil-square"></SvgAsset>
                            <span>编辑</span>
                        </div>
                    </Condition>
                    {options}
                </div>
                <div className="search-in-music-list-container">
                    <input
                        spellCheck={false}
                        placeholder={`在 ${musicList.length} 首歌曲中搜索`}
                        onChange={(evt) => {
                            setInputSearch(evt.target.value);
                        }}
                        onKeyDown={(evt) => {
                            if (evt.key === "Escape") {
                                setInputSearch("");
                            }
                        }}
                        value={inputSearch}
                        className="search-in-music-list"
                    ></input>
                    {inputSearch ? (
                        <div
                            role="button"
                            className="search-in-music-list-clear"
                            title="清空搜索"
                            onClick={() => {
                                setInputSearch("");
                            }}
                        >
                            <SvgAsset iconName="x-mark"></SvgAsset>
                        </div>
                    ) : (
                        <SvgAsset iconName="magnifying-glass"></SvgAsset>
                    )}
                    {inputSearch.trim() && filterMusicList ? (
                        <div className="search-in-music-list-count">
                            {filterMusicList.length}/{musicList.length}
                        </div>
                    ) : null}
                </div>
            </div>
            <button
                type="button"
                className="music-sheetlike-locate-floating"
                title="定位到当前播放歌曲"
                aria-label="定位到当前播放歌曲"
                data-disabled={!musicList?.length}
                onClick={handleLocateCurrentMusic}
            >
                <SvgAsset iconName="headphone"></SvgAsset>
            </button>
            <Condition
                condition={
                    (!isPending || filterMusicList === null) &&
          state !== RequestStateCode.PENDING_FIRST_PAGE
                }
                falsy={<Loading></Loading>}
            >
                <MusicList
                    musicList={visibleMusicList}
                    // getAllMusicItems={() => musicList} // TODO: 过滤歌曲
                    musicSheet={musicSheet}
                    state={state}
                    onPageChange={onLoadMore}
                    virtualProps={{
                        getScrollElement() {
                            return document.querySelector("#page-container");
                        },
                    }}
                    enableDrag={musicSheet?.platform === localPluginName}
                    locateMusicItem={locateMusicItem}
                    locateRequestKey={locateRequestKey}
                    onDragEnd={(newData) => {
                        if (musicSheet?.platform === localPluginName && musicSheet?.id) {
                            MusicSheet.frontend.updateSheetMusicOrder(musicSheet.id, newData);
                        }
                    }}
                ></MusicList>
            </Condition>
        </div>
    );
}
