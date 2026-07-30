import { PlayerState } from "@/common/constant";
import { isSameMedia } from "@/common/media-util";
import {
  useCurrentMusic,
  usePlayerState,
} from "@renderer/core/track-player/hooks";
import { memo } from "react";
import "./index.scss";

interface IPlayingIndicatorProps {
  musicItem: IMusic.IMusicItem;
}

function PlayingIndicator(props: IPlayingIndicatorProps) {
  const currentMusic = useCurrentMusic();
  const playerState = usePlayerState();
  const isCurrent = isSameMedia(currentMusic, props.musicItem);
  const isPlaying = isCurrent && playerState === PlayerState.Playing;

  return (
    <span
      className="playing-indicator"
      data-visible={isCurrent}
      data-playing={isPlaying}
      title={isCurrent ? "\u5f53\u524d\u64ad\u653e" : undefined}
      aria-hidden="true"
    >
      <i></i>
      <i></i>
      <i></i>
    </span>
  );
}

export default memo(PlayingIndicator, (prev, curr) =>
  isSameMedia(prev.musicItem, curr.musicItem),
);
