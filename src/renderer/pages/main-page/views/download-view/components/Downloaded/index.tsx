import MusicList from "@/renderer/components/MusicList";
import Downloader from "@/renderer/core/downloader";
import { useRef } from "react";
import Empty from "@/renderer/components/Empty";
import SvgAsset from "@/renderer/components/SvgAsset";
import { shellUtil } from "@shared/utils/renderer";
import { getGlobalContext } from "@/shared/global-context/renderer";
import AppConfig from "@shared/app-config/renderer";
import { toast } from "react-toastify";

export default function Downloaded() {
  const downloadedList = Downloader.useDownloadedMusicList();
  const musicListContainerRef = useRef<HTMLDivElement>();

  const downloadPath =
    AppConfig.getConfig("download.path") ??
    getGlobalContext().appPath.downloads;

  return (
    <div className="downloaded-panel" ref={musicListContainerRef}>
      <div className="download-panel-toolbar">
        <div className="download-panel-summary">
          <span>
            {"\u5df2\u4e0b\u8f7d"} {downloadedList.length}
          </span>
          <span title={downloadPath}>{downloadPath}</span>
        </div>
        <button
          type="button"
          className="download-panel-button"
          onClick={async () => {
            try {
              await shellUtil.openPath(downloadPath);
            } catch (e) {
              toast.error(
                `\u65e0\u6cd5\u6253\u5f00\u4e0b\u8f7d\u76ee\u5f55\uff1a${e?.message ?? ""}`,
              );
            }
          }}
        >
          <SvgAsset iconName="folder-open" size={16}></SvgAsset>
          <span>{"\u6253\u5f00\u4e0b\u8f7d\u76ee\u5f55"}</span>
        </button>
      </div>
      {!downloadedList.length ? (
        <Empty>
          {"\u8fd8\u6ca1\u6709\u5df2\u4e0b\u8f7d\u7684\u97f3\u4e50"}
        </Empty>
      ) : (
        <MusicList
          musicList={downloadedList}
          virtualProps={{
            getScrollElement() {
              return document.querySelector("#page-container");
            },
            offsetHeight: () => musicListContainerRef.current.offsetTop,
          }}
        ></MusicList>
      )}
    </div>
  );
}
