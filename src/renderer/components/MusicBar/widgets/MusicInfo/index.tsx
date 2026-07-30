import SvgAsset from "@/renderer/components/SvgAsset";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import "./index.scss";

import Tag from "@/renderer/components/Tag";
import { secondsToDuration } from "@/common/time-util";
import MusicFavorite from "@/renderer/components/MusicFavorite";
import MusicDetail, {
  useMusicDetailShown,
} from "@/renderer/components/MusicDetail";
import albumImg from "@/assets/imgs/album-cover.jpg";
import { useTranslation } from "react-i18next";
import {
  useCurrentMusic,
  useProgress,
} from "@renderer/core/track-player/hooks";
import { hidePanel, showPanel } from "@renderer/components/Panel";
import { showModal } from "@/renderer/components/Modal";
import MusicDownloaded from "@renderer/components/MusicDownloaded";
import PluginManager from "@shared/plugin-manager/renderer";

export default function MusicInfo() {
  const musicItem = useCurrentMusic();
  const musicDetailShown = useMusicDetailShown();

  const { t } = useTranslation();
  const canViewComments =
    !!musicItem &&
    PluginManager.isSupportFeatureMethod(
      musicItem?.platform,
      "getMusicComments",
    );

  function toggleMusicDetail() {
    if (musicDetailShown) {
      MusicDetail.hide();
    } else {
      MusicDetail.show();
      hidePanel();
    }
  }

  return (
    <div className="music-info-outer-container">
      <div
        data-detail-shown={musicDetailShown}
        className="music-info-content-container"
      >
        <div className="music-info-container">
          {!musicItem ? null : (
            <>
              <img
                role="button"
                className="music-cover"
                crossOrigin="anonymous"
                src={musicItem.artwork ?? albumImg}
                onError={setFallbackAlbum}
              ></img>

              <div
                className="open-detail"
                role="button"
                title={
                  musicDetailShown
                    ? t("music_bar.close_music_detail_page")
                    : t("music_bar.open_music_detail_page")
                }
                onClick={toggleMusicDetail}
              >
                <SvgAsset
                  iconName={
                    musicDetailShown
                      ? "chevron-double-down"
                      : "chevron-double-up"
                  }
                ></SvgAsset>
              </div>
              <div className="music-info">
                <div className="music-title">
                  <span
                    role="button"
                    onClick={toggleMusicDetail}
                    title={musicItem.title}
                  >
                    {musicItem.title}
                  </span>
                  <Tag
                    fill
                    style={{
                      fontSize: "0.9rem",
                    }}
                  >
                    {musicItem.platform}
                  </Tag>
                </div>
                <div className="music-artist">
                  <div className="artist">{musicItem.artist}</div>
                  <Progress></Progress>
                  <MusicFavorite
                    musicItem={musicItem}
                    size={18}
                  ></MusicFavorite>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div
        data-detail-shown={musicDetailShown}
        className="music-info-content-container music-info-operations-container"
      >
        <div
          className="open-detail"
          role="button"
          title={
            musicDetailShown
              ? t("music_bar.close_music_detail_page")
              : t("music_bar.open_music_detail_page")
          }
          onClick={toggleMusicDetail}
        >
          <SvgAsset
            iconName={
              musicDetailShown ? "chevron-double-down" : "chevron-double-up"
            }
          ></SvgAsset>
        </div>
        <MusicFavorite musicItem={musicItem} size={22}></MusicFavorite>
        <div
          role="button"
          className="music-info-action-button"
          title={"\u6536\u85cf\u5230"}
          aria-label={"\u6536\u85cf\u5230"}
          data-state={musicItem ? "ready" : "blocked"}
          onClick={(e) => {
            e.stopPropagation();
            if (!musicItem) {
              return;
            }
            showModal("AddMusicToSheet", {
              musicItems: [musicItem],
            });
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <SvgAsset iconName="document-plus" size={18}></SvgAsset>
        </div>
        <div
          role="button"
          className="music-info-action-button"
          title={canViewComments ? "查看评论" : "当前平台暂不支持评论"}
          data-state={canViewComments ? "ready" : "blocked"}
          onClick={() => {
            if (!musicItem || !canViewComments) {
              return;
            }
            showPanel("MusicComment", {
              musicItem: musicItem,
              coverHeader: false,
            });
          }}
        >
          <SvgAsset iconName="chat-bubble-left-ellipsis" size={18}></SvgAsset>
        </div>
        <MusicDownloaded
          musicItem={musicItem}
          size={18}
          showDownloadedTip
        ></MusicDownloaded>
        <div className="music-info-operation-divider"></div>
        <Progress></Progress>
      </div>
    </div>
  );
}

function Progress() {
  const { currentTime, duration } = useProgress();
  return (
    <div className="progress">
      {isFinite(duration)
        ? `${secondsToDuration(currentTime)}/${secondsToDuration(duration)}`
        : null}
    </div>
  );
}
