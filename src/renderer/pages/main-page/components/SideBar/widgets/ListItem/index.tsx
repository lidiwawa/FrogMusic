import SvgAsset, { SvgAssetIconNames } from "@/renderer/components/SvgAsset";
import "./index.scss";
import { HTMLAttributes, MouseEventHandler } from "react";

interface IProps extends HTMLAttributes<HTMLDivElement> {
    selected?: boolean;
    onClick?: MouseEventHandler<HTMLDivElement>;
    onContextMenu?: MouseEventHandler<HTMLDivElement>;
    iconName?: SvgAssetIconNames;
    title?: string;
}

export default function ListItem(props: IProps) {
    const {
        selected,
        onClick,
        iconName,
        title,
        onContextMenu,
        className,
        ...restProps
    } = props ?? {};
    return (
        <div
            onClick={onClick}
            onContextMenu={onContextMenu}
            title={title}
            role="button"
            className={`side-bar--list-item-container${className ? ` ${className}` : ""}`}
            data-selected={selected}
            {...restProps}
        >
            <div className="side-bar--list-item-accent"></div>
            <div className="side-bar--list-item-content">
                {iconName ? <SvgAsset iconName={iconName}></SvgAsset> : null}
                <span>{title ?? ""}</span>
            </div>
            <div className="side-bar--list-item-glow"></div>
        </div>
    );
}
