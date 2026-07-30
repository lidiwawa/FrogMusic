import { getInternalData, isSameMedia } from "@/common/media-util";
import SvgAsset, { SvgAssetIconNames } from "@/renderer/components/SvgAsset";
import { memo } from "react";
import "./index.scss";
import { DownloadState, localPluginName } from "@/common/constant";
import Downloader from "@/renderer/core/downloader";
import { useTranslation } from "react-i18next";
import PluginManager from "@shared/plugin-manager/renderer";
import musicSheetDB from "@/renderer/core/db/music-sheet-db";
import { shellUtil } from "@shared/utils/renderer";
import { toast } from "react-toastify";

interface IMusicDownloadedProps {
  musicItem: IMusic.IMusicItem;
  size?: number;
  showText?: boolean;
  showDownloadedTip?: boolean;
}

function MusicDownloaded(props: IMusicDownloadedProps) {
  const {
    musicItem,
    size = 18,
    showText = false,
    showDownloadedTip = false,
  } = props;

  const downloadState = Downloader.useDownloadState(musicItem);

  const { t } = useTranslation();
  const canDownload =
    !!musicItem &&
    musicItem?.platform !== localPluginName &&
    PluginManager.isSupportFeatureMethod(musicItem?.platform, "getMediaSource");
  const isDownloadedOrLocal =
    downloadState === DownloadState.DONE ||
    musicItem?.platform === localPluginName;
  const isDownloading =
    downloadState === DownloadState.WAITING ||
    downloadState === DownloadState.DOWNLOADING;
  const isBlocked = !isDownloadedOrLocal && !isDownloading && !canDownload;
  const canStartDownload =
    !!musicItem && !isDownloadedOrLocal && !isDownloading && canDownload;

  async function openDownloadedInFolder() {
    try {
      let targetPath = musicItem?.localPath;

      if (!targetPath && musicItem?.url?.startsWith?.("file:")) {
        targetPath = decodeURIComponent(
          new URL(musicItem.url).pathname,
        ).replace(/^\/([A-Za-z]:)/, "$1");
      }

      if (!targetPath && musicItem?.platform !== localPluginName) {
        const realTimeMusicItem = await musicSheetDB.musicStore.get([
          musicItem.platform,
          musicItem.id,
        ]);
        targetPath = getInternalData<IMusic.IMusicItemInternalData>(
          realTimeMusicItem,
          "downloadData",
        )?.path;
      }

      if (!targetPath) {
        throw new Error("未找到本地文件路径");
      }

      const opened = await shellUtil.showItemInFolder(targetPath);
      if (!opened) {
        throw new Error("打开文件夹失败");
      }
    } catch (e) {
      toast.error(`无法打开文件夹：${e?.message ?? ""}`);
    }
  }

  let iconName: SvgAssetIconNames = "array-download-tray";

  if (isDownloadedOrLocal) {
    iconName = "check-circle";
  } else if (isDownloading) {
    iconName = "rolling-1s";
  }

  const text = isDownloadedOrLocal
    ? t("common.downloaded")
    : isDownloading
      ? "下载中"
      : isBlocked
        ? "不可下载"
        : downloadState === DownloadState.ERROR
          ? "重试下载"
          : t("common.download");

  return (
    <div
      className={`music-download-base ${
        showText ? "music-download-base--with-text" : ""
      } ${
        showDownloadedTip && isDownloadedOrLocal
          ? "music-download-base--with-downloaded-tip"
          : ""
      } ${
        isDownloadedOrLocal
          ? "music-downloaded"
          : isBlocked
            ? "music-download-blocked"
            : "music-can-download"
      }`}
      data-disabled={isBlocked || isDownloading ? "true" : undefined}
      data-state={
        isDownloadedOrLocal
          ? "downloaded"
          : isDownloading
            ? "loading"
            : isBlocked
              ? "blocked"
              : "ready"
      }
      title={
        isDownloadedOrLocal
          ? "已下载，点击打开文件夹"
          : isBlocked
            ? "当前平台不支持下载"
            : isDownloading
              ? "下载中..."
              : downloadState === DownloadState.ERROR
                ? "下载失败，点击重试"
                : t("common.download")
      }
      onClick={(e) => {
        e.stopPropagation();
        if (isDownloadedOrLocal) {
          openDownloadedInFolder();
        } else if (canStartDownload) {
          Downloader.startDownload(musicItem);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
      }}
    >
      <SvgAsset iconName={iconName} size={size}></SvgAsset>
      {showText ? <span className="music-download-label">{text}</span> : null}
      {!showText && showDownloadedTip && isDownloadedOrLocal ? (
        <span className="music-download-label">{t("common.downloaded")}</span>
      ) : null}
    </div>
  );
}

export default memo(
  MusicDownloaded,
  (prev, curr) =>
    isSameMedia(prev.musicItem, curr.musicItem) &&
    prev.size === curr.size &&
    prev.showText === curr.showText &&
    prev.showDownloadedTip === curr.showDownloadedTip,
);
