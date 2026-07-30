import { useEffect, useRef, useState } from "react";
import SvgAsset from "@/renderer/components/SvgAsset";
import { PlayerState } from "@/common/constant";
import albumImg from "@/assets/imgs/album-cover.jpg";

import "./index.scss";
import { useTranslation } from "react-i18next";
import { useUserPreference } from "@/renderer/utils/user-perference";
import { appWindowUtil } from "@shared/utils/renderer";
import messageBus, {
  useAppStatePartial,
} from "@shared/message-bus/renderer/extension";

export default function MinimodePage() {
  const [hover, setHover] = useState(false);
  const currentMusicItem = useAppStatePartial("musicItem");
  const playerState = useAppStatePartial("playerState");
  const lyricItem = useAppStatePartial("parsedLrc");
  const hasRevealedWindowRef = useRef(false);

  const { t } = useTranslation();
  const [showTranslation] = useUserPreference("showTranslation");

  const restoreMainWindow = () => {
    appWindowUtil.setMinimodeWindow(false);
    appWindowUtil.showMainWindow();
  };

  useEffect(() => {
    // 初次状态尚未从主窗口同步时保持隐藏，避免短暂显示“未命名”和默认封面。
    if (currentMusicItem === undefined || hasRevealedWindowRef.current) {
      return;
    }
    hasRevealedWindowRef.current = true;
    appWindowUtil.revealMinimodeWindow();
  }, [currentMusicItem]);

  const textContent = (
    <div className="text-container">
      <span>
        {lyricItem?.lrc || currentMusicItem?.title || t("media.unknown_title")}
      </span>
      {showTranslation ? <span>{lyricItem?.translation}</span> : null}
    </div>
  );

  const options = (
    <div className="options-container">
      <div
        role="button"
        className="option-item"
        title={t("music_bar.previous_music")}
        onClick={() => {
          messageBus.sendCommand("SkipToPrevious");
        }}
      >
        <SvgAsset iconName="skip-left"></SvgAsset>
      </div>
      <div
        role="button"
        className="option-item option-item--play"
        title={
          playerState === PlayerState.Playing
            ? t("common.pause")
            : t("common.play")
        }
        onClick={() => {
          messageBus.sendCommand("TogglePlayerState");
        }}
      >
        <SvgAsset
          iconName={playerState === PlayerState.Playing ? "pause" : "play"}
        ></SvgAsset>
      </div>

      <div
        role="button"
        className="option-item"
        title={t("music_bar.next_music")}
        onClick={() => {
          messageBus.sendCommand("SkipToNext");
        }}
      >
        <SvgAsset iconName="skip-right"></SvgAsset>
      </div>
    </div>
  );

  return (
    <div className="minimode-page-container">
      <div
        className="minimode-header-container"
        onMouseEnter={() => {
          setHover(true);
        }}
        onMouseLeave={() => {
          setHover(false);
        }}
      >
        <div className="mini-mode-header-background-mask"></div>
        <div
          className="mini-mode-header-background"
          style={{
            backgroundImage: `url(${currentMusicItem?.artwork || albumImg})`,
          }}
        ></div>
        <img
          title={
            (currentMusicItem?.title || t("media.unknown_title")) +
            " - " +
            (currentMusicItem?.artist || t("media.unknown_artist"))
          }
          draggable="false"
          className="album-container"
          src={currentMusicItem?.artwork || albumImg}
          onDoubleClick={restoreMainWindow}
        ></img>
        <div className="body-container">{hover ? options : textContent}</div>
        <div
          role="button"
          className="restore-full-button"
          title="恢复完整模式"
          onClick={restoreMainWindow}
        >
          <SvgAsset iconName="bolt"></SvgAsset>
        </div>
      </div>
    </div>
  );
}
