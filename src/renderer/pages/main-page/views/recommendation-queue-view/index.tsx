import MusicSheetlikeView from "@/renderer/components/MusicSheetlikeView";
import SvgAsset from "@/renderer/components/SvgAsset";
import { RequestStateCode } from "@/common/constant";
import {
    fetchNeteaseRecommendationQueue,
    NeteaseRecommendationKey,
} from "@/renderer/core/netease-recommendations";
import { toast } from "react-toastify";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

type RecommendationConfig = {
    title: string;
    description: string;
    refreshLabel: string;
};

const recommendationConfigs: Record<NeteaseRecommendationKey, RecommendationConfig> = {
    daily: {
        title: "每日推荐",
        description: "网易云每天更新的个性化推荐。歌曲只作为临时内容展示，点击心形即可主动收藏。",
        refreshLabel: "刷新日推",
    },
    privateRadar: {
        title: "私人雷达",
        description: "根据近期偏好生成的推荐内容。歌曲只作为临时内容展示，点击心形即可主动收藏。",
        refreshLabel: "更新雷达",
    },
    personalFm: {
        title: "私人漫游",
        description: "网易云实时生成的私人 FM 队列，不会保存到“我的歌单”。点击心形即可主动收藏。",
        refreshLabel: "换一批",
    },
};

function isRecommendationKey(value?: string): value is NeteaseRecommendationKey {
    return value === "daily" || value === "privateRadar" || value === "personalFm";
}

export default function RecommendationQueueView() {
    const { kind } = useParams();
    const recommendationKey = isRecommendationKey(kind) ? kind : "daily";
    const config = recommendationConfigs[recommendationKey];
    const [musicList, setMusicList] = useState<IMusic.IMusicItem[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshQueue = useCallback(
        async (force = false) => {
            setLoading(true);
            try {
                setMusicList(
                    await fetchNeteaseRecommendationQueue(
                        recommendationKey,
                        force,
                    ),
                );
            } catch (error) {
                toast.error(
                    `${config.title}加载失败：${(error as Error)?.message ?? ""}`,
                );
            } finally {
                setLoading(false);
            }
        },
        [config.title, recommendationKey],
    );

    useEffect(() => {
        void refreshQueue();
    }, [refreshQueue]);

    const options = useMemo(
        () => (
            <div
                role="button"
                className="option-button"
                data-type="normalButton"
                data-disabled={loading}
                title={`获取最新${config.title}`}
                onClick={() => {
                    if (!loading) {
                        void refreshQueue(true);
                    }
                }}
            >
                <SvgAsset iconName="sparkles"></SvgAsset>
                <span>{loading ? "加载中..." : config.refreshLabel}</span>
            </div>
        ),
        [config.refreshLabel, config.title, loading, refreshQueue],
    );

    return (
        <div id="page-container" className="page-container">
            <MusicSheetlikeView
                hidePlatform
                musicSheet={{
                    id: `netease-recommendation-${recommendationKey}`,
                    platform: "网易云",
                    title: config.title,
                    description: config.description,
                    worksNum: musicList.length,
                }}
                musicList={musicList}
                state={
                    loading
                        ? RequestStateCode.PENDING_FIRST_PAGE
                        : RequestStateCode.FINISHED
                }
                options={options}
            ></MusicSheetlikeView>
        </div>
    );
}
