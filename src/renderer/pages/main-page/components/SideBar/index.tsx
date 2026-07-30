import ListItem from "./widgets/ListItem";
import "./index.scss";
import MySheets from "./widgets/MySheets";
import { useMatch, useNavigate } from "react-router";
import StarredSheets from "./widgets/StarredSheets";
import { useTranslation } from "react-i18next";

export default function () {
    const navigate = useNavigate();
    const routePathMatch = useMatch("/main/:routePath");
    const { t } = useTranslation();
    const dailyRecommendationsSelected =
        routePathMatch?.params?.routePath === "daily-recommendations";

    const options = [
        {
            iconName: "trophy",
            title: t("side_bar.toplist"),
            route: "toplist",
        },
        {
            iconName: "fire",
            title: t("side_bar.recommend_sheets"),
            route: "recommend-sheets",
        },
        {
            iconName: "array-download-tray",
            title: t("side_bar.download_management"),
            route: "download",
        },
        {
            iconName: "folder-open",
            title: t("side_bar.local_music"),
            route: "local-music",
        },
        {
            iconName: "code-bracket-square",
            title: t("side_bar.plugin_management"),
            route: "plugin-manager-view",
        },
        {
            iconName: "clock",
            title: t("side_bar.recently_play"),
            route: "recently_play",
        },
    ] as const;

    return (
        <div className="side-bar-container">
            <div
                className="side-bar-header"
                role="button"
                tabIndex={0}
                data-selected={dailyRecommendationsSelected}
                title="每日推荐"
                onClick={() => {
                    navigate("/main/daily-recommendations");
                }}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate("/main/daily-recommendations");
                    }
                }}
            >
                <div className="side-bar-brand">
                    <span className="side-bar-brand__title">每日推荐</span>
                    <span className="side-bar-brand__sub">DAILY PICKS</span>
                </div>
            </div>
            <div className="side-bar-section side-bar-section--nav">
                {options.map((item) => (
                    <ListItem
                        key={item.route}
                        iconName={item.iconName}
                        title={item.title}
                        selected={routePathMatch?.params?.routePath === item.route}
                        onClick={() => {
                            navigate(`/main/${item.route}`);
                        }}
                    ></ListItem>
                ))}
            </div>
            <div className="side-bar-section side-bar-section--sheets">
                <MySheets></MySheets>
                <StarredSheets></StarredSheets>
            </div>
            <div className="side-bar-footer">
                <div className="side-bar-footer__tag">NEON NIGHT</div>
            </div>
        </div>
    );
}
