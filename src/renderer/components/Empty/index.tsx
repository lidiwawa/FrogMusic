import { CSSProperties, ReactNode } from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";

interface IEmptyProps {
    style?: CSSProperties;
    children?: ReactNode;
}

export default function Empty(props: IEmptyProps) {
    const { style, children } = props;
    const { t } = useTranslation();

    return (
        <div className="components--empty-container" style={style}>
            {children ?? t("empty.hint_empty")}
        </div>
    );
}
