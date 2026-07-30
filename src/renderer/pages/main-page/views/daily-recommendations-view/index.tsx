import { useNavigate } from "react-router-dom";

import "./index.scss";

type RecommendationCard = {
    id: "daily" | "privateRadar" | "personalFm";
    title: string;
    eyebrow: string;
    description: string;
    updateText: string;
    tone: "daily" | "radar" | "roam";
};

const recommendationCards: RecommendationCard[] = [
    {
        id: "daily",
        title: "每日推荐",
        eyebrow: "DAILY DISCOVERY",
        description: "按你的听歌口味，每天更新的新歌与旧爱。",
        updateText: "每日更新",
        tone: "daily",
    },
    {
        id: "privateRadar",
        title: "私人雷达",
        eyebrow: "PERSONAL RADAR",
        description: "根据最近偏好挑出的专属推荐歌单。",
        updateText: "推荐歌单",
        tone: "radar",
    },
    {
        id: "personalFm",
        title: "私人漫游",
        eyebrow: "PRIVATE ROAM",
        description: "实时生成的私人 FM 队列，不保存为普通歌单。",
        updateText: "实时推荐",
        tone: "roam",
    },
];

export default function DailyRecommendationsView() {
    const navigate = useNavigate();

    function openRecommendation(card: RecommendationCard) {
        navigate(`/main/recommendation/${card.id}`);
    }

    return (
        <div id="page-container" className="page-container daily-recommendations-view">
            <div className="daily-recommendations-view__tabs" role="tablist">
                <button
                    type="button"
                    className="daily-recommendations-view__tab"
                    data-active
                    role="tab"
                    aria-selected="true"
                >
                    网易云
                </button>
                <button
                    type="button"
                    className="daily-recommendations-view__tab"
                    role="tab"
                    aria-selected="false"
                    disabled
                    title="QQ音乐推荐暂未接入"
                >
                    QQ音乐
                </button>
            </div>

            <header className="daily-recommendations-view__header">
                <div>
                    <span className="daily-recommendations-view__kicker">FOR YOU</span>
                    <h1>每日推荐</h1>
                    <p>打开一张卡片，查看已同步到 FrogMusic 的专属推荐歌单。</p>
                </div>
            </header>

            <section className="daily-recommendations-view__grid" aria-label="网易云每日推荐">
                {recommendationCards.map((card) => {
                    return (
                        <button
                            type="button"
                            key={card.id}
                            className="daily-recommendation-card"
                            data-tone={card.tone}
                            onClick={() => openRecommendation(card)}
                        >
                            <div className="daily-recommendation-card__cover">
                                <span className="daily-recommendation-card__eyebrow">
                                    {card.eyebrow}
                                </span>
                                <strong>{card.title}</strong>
                                <span className="daily-recommendation-card__mark">
                                    {card.updateText}
                                </span>
                            </div>
                            <div className="daily-recommendation-card__meta">
                                <div>
                                    <h2>{card.title}</h2>
                                    <p>{card.description}</p>
                                </div>
                                <span
                                    className="daily-recommendation-card__status"
                                    data-synced
                                >
                                    实时推荐，点击进入
                                </span>
                            </div>
                        </button>
                    );
                })}
            </section>
        </div>
    );
}
