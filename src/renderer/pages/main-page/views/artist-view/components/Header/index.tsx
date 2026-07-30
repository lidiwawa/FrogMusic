import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import albumImg from "@/assets/imgs/album-cover.jpg";
import Tag from "@/renderer/components/Tag";
import "./index.scss";
import { useTranslation } from "react-i18next";

interface IProps {
    artistItem: IArtist.IArtistItem;
}

export default function Header(props: IProps) {
    const { artistItem } = props;
    const { t } = useTranslation();

    const description = artistItem?.description?.replace?.(/\\n/g, "\n")?.trim?.() ?? "";
    const worksNum = (artistItem as any)?.worksNum;

    return (
        <div className="artist-view--header-container">
            <img
                draggable={false}
                src={artistItem?.avatar ?? albumImg}
                onError={setFallbackAlbum}
            ></img>
            <div className="artist-info">
                <div className="title-container">
                    <Tag>{artistItem?.platform}</Tag>
                    <div className="title">
                        {artistItem?.name ?? t("media.unknown_artist")}
                    </div>
                </div>

                <div className="artist-meta-container">
                    {typeof artistItem?.fans === "number" ? (
                        <span>{`\u7c89\u4e1d ${artistItem.fans.toLocaleString()}`}</span>
                    ) : null}
                    {typeof worksNum === "number" ? (
                        <span>{`\u4f5c\u54c1 ${worksNum}`}</span>
                    ) : null}
                </div>

                <div className="artist-description-card">
                    <div className="artist-description-title">{"\u6b4c\u624b\u7b80\u4ecb"}</div>
                    <div
                        className="info-container description-container"
                        data-fold="true"
                        data-empty={!description}
                        title={description || "\u6682\u65e0\u7b80\u4ecb"}
                        onClick={(e) => {
                            if (!description) {
                                return;
                            }
                            const dataset = e.currentTarget.dataset;
                            dataset.fold = dataset.fold === "true" ? "false" : "true";
                        }}
                    >
                        {description || "\u6682\u65e0\u7b80\u4ecb"}
                    </div>
                </div>
            </div>
        </div>
    );
}
