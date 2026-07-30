import A from "@/renderer/components/A";
import checkUpdate from "@/renderer/utils/check-update";
import { toast } from "react-toastify";
import "./index.scss";
import { Trans, useTranslation } from "react-i18next";
import { getGlobalContext } from "@/shared/global-context/renderer";

const frogMusicDescription =
    "FrogMusic \u662f\u57fa\u4e8e MusicFree / MusicFreeDesktop \u4e8c\u6b21\u5f00\u53d1\u7684\u684c\u9762\u97f3\u4e50\u64ad\u653e\u5668\uff0c\u611f\u8c22\u539f\u9879\u76ee\u4f5c\u8005 @maotoumao \u4ee5\u53ca\u5f00\u6e90\u793e\u533a\u63d0\u4f9b\u7684\u57fa\u7840\u80fd\u529b\u3002\u672c\u7248\u672c\u5728\u4fdd\u7559\u63d2\u4ef6\u5316\u64ad\u653e\u80fd\u529b\u7684\u57fa\u7840\u4e0a\uff0c\u9488\u5bf9\u754c\u9762\u6837\u5f0f\u3001\u6b4c\u5355\u4f53\u9a8c\u3001\u7f51\u6613\u4e91 / QQ \u97f3\u4e50\u4f7f\u7528\u3001\u8bc4\u8bba\u3001\u4e0b\u8f7d\u63d0\u793a\u3001\u8ff7\u4f60\u6a21\u5f0f\u7b49\u529f\u80fd\u505a\u4e86\u5b9a\u5236\u4f18\u5316\u3002\u672c\u9879\u76ee\u4e3b\u8981\u7528\u4e8e\u4e2a\u4eba\u5b66\u4e60\u4e0e\u4ea4\u6d41\uff0c\u8bf7\u9075\u5b88\u76f8\u5173\u5f00\u6e90\u534f\u8bae\u4ee5\u53ca\u5404\u97f3\u4e50\u5e73\u53f0\u89c4\u5219\u3002";

export default function About() {
    const { t } = useTranslation();

    return (
        <div className="setting-view--about-container">
            <div className="setting-row about-version">
                <Trans
                    i18nKey={"settings.about.current_version"}
                    values={{
                        version: getGlobalContext().appVersion,
                    }}
                ></Trans>
                <A
                    onClick={async () => {
                        const needUpdate = await checkUpdate(true);
                        if (!needUpdate) {
                            toast.success(t("settings.about.already_latest"));
                        }
                    }}
                >
                    {t("settings.about.check_update")}
                </A>
            </div>

            <div className="setting-row about-title">FrogMusic</div>
            <div className="setting-row about-description">{frogMusicDescription}</div>
            <div className="setting-row about-credit">
                <span>{"\u539f\u9879\u76ee\uff1a"}</span>
                <A href="https://github.com/maotoumao/MusicFree">MusicFree</A>
                <A href="https://github.com/maotoumao/MusicFreeDesktop">
                    MusicFreeDesktop
                </A>
                <span>{"\u539f\u4f5c\u8005\uff1a"}</span>
                <A href="https://github.com/maotoumao">@maotoumao</A>
            </div>
        </div>
    );
}
