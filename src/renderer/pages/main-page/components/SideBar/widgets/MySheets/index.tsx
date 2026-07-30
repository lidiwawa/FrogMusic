import "./index.scss";
import ListItem from "../ListItem";
import { useMatch, useNavigate } from "react-router-dom";
import { Disclosure } from "@headlessui/react";
import { MouseEvent, useRef, useState } from "react";
import MusicSheet, { defaultSheet } from "@/renderer/core/music-sheet";
import SvgAsset from "@/renderer/components/SvgAsset";
import { hideModal, showModal } from "@/renderer/components/Modal";
import { localPluginName } from "@/common/constant";
import { showContextMenu } from "@/renderer/components/ContextMenu";
import { useTranslation } from "react-i18next";
import { useSupportedPlugin } from "@shared/plugin-manager/renderer";
import DragReceiver, { startDrag } from "@/renderer/components/DragReceiver";

const SHEET_DRAG_TAG = "my-sheets";
const LONG_PRESS_DELAY = 350;

export default function MySheets() {
    const sheetIdMatch = useMatch(
        `/main/musicsheet/${encodeURIComponent(localPluginName)}/:sheetId`,
    );
    const currentSheetId = sheetIdMatch?.params?.sheetId;
    const musicSheets = MusicSheet.frontend.useAllSheets();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [movingSheetId, setMovingSheetId] = useState<string | null>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const suppressClickRef = useRef(false);

    const importablePlugins = useSupportedPlugin("importMusicSheet");
    const sheetCount = musicSheets.length;
    const defaultMusicSheet = musicSheets.find((item) => item.id === defaultSheet.id);
    const movableMusicSheets = musicSheets.filter((item) => item.id !== defaultSheet.id);

    function clearLongPressTimer() {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }

    function endLongPress() {
        clearLongPressTimer();
        setMovingSheetId(null);
    }

    function beginLongPress(e: MouseEvent<HTMLDivElement>, sheetId: string) {
        if (e.button !== 0 || sheetId === defaultSheet.id) {
            return;
        }
        clearLongPressTimer();
        suppressClickRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
            suppressClickRef.current = true;
            setMovingSheetId(sheetId);
        }, LONG_PRESS_DELAY);
    }

    async function moveSheet(fromIndex: number, toIndex: number) {
        if (fromIndex < 0 || fromIndex >= movableMusicSheets.length) {
            return;
        }

        const nextMovableSheets = movableMusicSheets.slice();
        const [movedSheet] = nextMovableSheets.splice(fromIndex, 1);
        nextMovableSheets.splice(fromIndex < toIndex ? toIndex - 1 : toIndex, 0, movedSheet);

        await MusicSheet.frontend.updateSheetOrder([
            defaultSheet.id,
            ...nextMovableSheets.map((item) => item.id),
        ]);
    }

    return (
        <div className="side-bar-container--my-sheets">
            <div className="divider"></div>
            <Disclosure defaultOpen>
                <Disclosure.Button className="title" as="div" role="button">
                    <div className="my-sheets">
                        <span className="section-name">{t("side_bar.my_sheets")}</span>
                        <span className="section-count">{sheetCount}</span>
                    </div>
                    <div
                        role="button"
                        className="option-btn"
                        title={t("plugin.method_import_music_sheet")}
                        onClick={(e) => {
                            e.stopPropagation();
                            showModal("ImportMusicSheet", {
                                plugins: importablePlugins,
                            });
                        }}
                    >
                        <SvgAsset iconName="arrow-left-end-on-rectangle"></SvgAsset>
                    </div>
                    <div
                        role="button"
                        className="option-btn"
                        title={t("side_bar.create_local_sheet")}
                        onClick={(e) => {
                            e.stopPropagation();
                            showModal("AddNewSheet");
                        }}
                    >
                        <SvgAsset iconName="plus"></SvgAsset>
                    </div>
                </Disclosure.Button>
                <Disclosure.Panel>
                    {defaultMusicSheet ? (
                        <ListItem
                            key={defaultMusicSheet.id}
                            iconName="heart-outline"
                            onClick={() => {
                                if (currentSheetId !== defaultMusicSheet.id) {
                                    navigate(`/main/musicsheet/${encodeURIComponent(localPluginName)}/${encodeURIComponent(defaultMusicSheet.id)}`);
                                }
                            }}
                            selected={currentSheetId === defaultMusicSheet.id}
                            title={t("media.default_favorite_sheet_name")}
                        ></ListItem>
                    ) : null}
                    <div className="my-sheets-sortable-list">
                        {movableMusicSheets.map((item, index) => (
                            <div
                                key={item.id}
                                className="my-sheets-sortable-item"
                            >
                                {index === 0 ? (
                                    <DragReceiver
                                        position="top"
                                        rowIndex={0}
                                        tag={SHEET_DRAG_TAG}
                                        onDrop={moveSheet}
                                    ></DragReceiver>
                                ) : null}
                                <ListItem
                                    iconName="musical-note"
                                    draggable={movingSheetId === item.id}
                                    data-moving={movingSheetId === item.id}
                                    onMouseDown={(e) => beginLongPress(e, item.id)}
                                    onMouseUp={endLongPress}
                                    onMouseLeave={clearLongPressTimer}
                                    onDragStart={(e) => {
                                        if (movingSheetId !== item.id) {
                                            e.preventDefault();
                                            return;
                                        }
                                        startDrag(e, index, SHEET_DRAG_TAG);
                                    }}
                                    onDragEnd={() => {
                                        clearLongPressTimer();
                                        setMovingSheetId(null);
                                        setTimeout(() => {
                                            suppressClickRef.current = false;
                                        }, 0);
                                    }}
                                    onClick={() => {
                                        if (suppressClickRef.current) {
                                            suppressClickRef.current = false;
                                            return;
                                        }
                                        if (currentSheetId !== item.id) {
                                            navigate(`/main/musicsheet/${encodeURIComponent(localPluginName)}/${encodeURIComponent(item.id)}`);
                                        }
                                    }}
                            onContextMenu={(e) => {
                                endLongPress();
                                showContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    menuItems: [
                                        {
                                            title: t("side_bar.rename_sheet"),
                                            icon: "pencil-square",
                                            show: item.id !== defaultSheet.id,
                                            onClick() {
                                                showModal("SimpleInputWithState", {
                                                    placeholder: t(
                                                        "modal.create_local_sheet_placeholder",
                                                    ),
                                                    maxLength: 30,
                                                    title: t("side_bar.rename_sheet"),
                                                    defaultValue: item.title,
                                                    async onOk(text) {
                                                        await MusicSheet.frontend.updateSheet(item.id, {
                                                            title: text,
                                                        });
                                                        hideModal();
                                                    },
                                                });
                                            },
                                        },
                                        {
                                            title: t("side_bar.delete_sheet"),
                                            icon: "trash",
                                            show: item.id !== defaultSheet.id,
                                            onClick() {
                                                MusicSheet.frontend.removeSheet(item.id).then(() => {
                                                    if (currentSheetId === item.id) {
                                                        navigate(
                                                            `/main/musicsheet/${encodeURIComponent(localPluginName)}/${defaultSheet.id}`,
                                                            {
                                                                replace: true,
                                                            },
                                                        );
                                                    }
                                                });
                                            },
                                        },
                                    ],
                                });
                            }}
                            selected={currentSheetId === item.id}
                                    title={item.title}
                        ></ListItem>
                                <DragReceiver
                                    position="bottom"
                                    rowIndex={index + 1}
                                    tag={SHEET_DRAG_TAG}
                                    onDrop={moveSheet}
                                ></DragReceiver>
                            </div>
                        ))}
                    </div>
                </Disclosure.Panel>
            </Disclosure>
        </div>
    );
}
