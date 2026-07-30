import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import "./index.scss";
import albumImg from "@/assets/imgs/album-cover.jpg";
import Condition from "../Condition";
import dayjs from "dayjs";
import SvgAsset from "../SvgAsset";
import { normalizeNumber } from "@/common/normalize-util";
import { memo } from "react";
import { isCN } from "@/shared/i18n/renderer";

interface IMusicSheetlikeItemProps {
    mediaItem: IMusic.IMusicSheetItem;
    onClick?: (mediaItem: IMusic.IMusicSheetItem) => void;
}

function MusicSheetlikeItem(props: IMusicSheetlikeItemProps) {
    const { mediaItem, onClick } = props;
    const imageSrc = getSharperArtwork(mediaItem?.artwork || mediaItem?.coverImg || albumImg);
    const publishDate = getMediaPublishDate(mediaItem);

    return (
        <div
            className="components--albumlike-item-container"
            role="button"
            onClick={() => {
                onClick?.(mediaItem);
            }}
        >
            <div className="album-img-wrapper">
                <img
                    src={imageSrc}
                    onError={setFallbackAlbum}
                    loading='lazy'
                ></img>
                <Condition
                    condition={
                        mediaItem?.playCount || mediaItem?.worksNum || publishDate
                    }
                >
                    <div className="album-play-info">
                        {publishDate ? (
                            <span className="publish-date" title={`\u53d1\u884c\u65f6\u95f4 ${publishDate}`}>{publishDate}</span>
                        ) : (
                            <div></div>
                        )}
                        <div className="play-count">
                            <Condition condition={mediaItem?.playCount}>
                                <SvgAsset iconName={"headphone"} size={14}></SvgAsset>
                                {normalizeNumber(mediaItem?.playCount, !isCN())}
                            </Condition>
                        </div>
                    </div>
                </Condition>
            </div>
            <div className="media-info">
                <div className="title" title={mediaItem?.title}>
                    {mediaItem?.title}
                </div>
                <div className="author" title={mediaItem?.artist ?? mediaItem?.description}>
                    <span>{mediaItem?.artist ?? mediaItem?.description ?? ""}</span>
                </div>
                <Condition condition={publishDate}>
                    <div className="publish-time" title={`\u53d1\u884c\u65f6\u95f4 ${publishDate}`}>
                        {`\u53d1\u884c ${publishDate}`}
                    </div>
                </Condition>
            </div>
        </div>
    );
}


function getMediaPublishDate(mediaItem: IMusic.IMusicSheetItem) {
    const raw = mediaItem?.$raw ?? mediaItem?.$ ?? {};
    const value =
        (mediaItem as IAlbum.IAlbumItem)?.date ??
        mediaItem?.publishTime ??
        mediaItem?.publishDate ??
        mediaItem?.publicationTime ??
        mediaItem?.releaseTime ??
        mediaItem?.publicTime ??
        mediaItem?.createAt ??
        raw?.publishTime ??
        raw?.publishDate ??
        raw?.publicationTime ??
        raw?.releaseTime ??
        raw?.publicTime ??
        raw?.createAt;

    if (!value) {
        return "";
    }
    if (typeof value === "number") {
        return dayjs(value).format("YYYY-MM-DD");
    }
    const text = `${value}`.trim();
    if (!text) {
        return "";
    }
    const parsed = dayjs(text);
    return parsed.isValid() ? parsed.format("YYYY-MM-DD") : text;
}

function getSharperArtwork(src: string) {
    try {
        const url = new URL(src);

        if (url.hostname.endsWith("music.126.net")) {
            const param = url.searchParams.get("param");

            if (param?.match(/^\d+y\d+$/)) {
                url.searchParams.set("param", "300y300");
            }
        }

        return url.toString();
    } catch {
        return src;
    }
}

export default memo(
    MusicSheetlikeItem,
    (prev, curr) =>
        prev.mediaItem === curr.mediaItem && prev.onClick === curr.onClick,
);
