import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import albumImg from "@/assets/imgs/album-cover.jpg";
import { CommonConst } from "@/common/constant";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import MusicSheet from "@/renderer/core/music-sheet";
import { appUtil, dialogUtil, fsUtil } from "@shared/utils/renderer";
import { hideModal } from "../..";
import Base from "../Base";
import "./index.scss";

interface IProps {
    musicSheet: IMusic.IMusicSheetItem;
}

const DESCRIPTION_LIMIT = 1000;

function getFileExtension(filePath: string) {
    const fileName = filePath.split(/[\\/]/).pop() ?? "";
    const match = fileName.match(/\.([a-zA-Z0-9]+)$/);
    return match?.[1]?.toLowerCase() ?? "png";
}

function getSafeFileNamePart(text: string) {
    return (text || "sheet").replace(/[^\w.-]/g, "_").slice(0, 80);
}

async function copyCoverToUserData(filePath: string, sheetId: string) {
    const userData = await appUtil.getPath("userData");
    const ext = getFileExtension(filePath);
    const safeId = getSafeFileNamePart(sheetId);
    const targetPath = `${userData}\\sheet-cover-${safeId}-${Date.now()}.${ext}`;
    const fileContent = await fsUtil.readFile(filePath);
    await fsUtil.writeFile(targetPath, fileContent);
    return fsUtil.addFileScheme(targetPath);
}

export default function EditMusicSheet(props: IProps) {
    const { musicSheet } = props;
    const [title, setTitle] = useState(musicSheet?.title ?? "");
    const [description, setDescription] = useState(musicSheet?.description ?? "");
    const [previewArtwork, setPreviewArtwork] = useState(
        musicSheet?.artwork ?? musicSheet?.coverImg ?? "",
    );
    const [selectedCoverPath, setSelectedCoverPath] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const trimmedTitle = useMemo(() => title.trim(), [title]);
    const canSave = trimmedTitle.length > 0 && !saving;

    async function selectCover() {
        const result = await dialogUtil.showOpenDialog({
            title: "选择歌单封面",
            buttonLabel: "使用图片",
            properties: ["openFile"],
            filters: [
                {
                    name: "图片文件",
                    extensions: ["jpg", "jpeg", "png", "webp", "gif"],
                },
            ],
        });

        if (result.canceled || !result.filePaths?.[0]) {
            return;
        }

        const filePath = result.filePaths[0];
        setSelectedCoverPath(filePath);
        setPreviewArtwork(fsUtil.addFileScheme(filePath));
    }

    async function saveSheetInfo() {
        if (!canSave) {
            return;
        }

        try {
            setSaving(true);
            const finalArtwork = selectedCoverPath
                ? await copyCoverToUserData(selectedCoverPath, musicSheet.id)
                : previewArtwork;

            await MusicSheet.frontend.updateSheet(musicSheet.id, {
                title: trimmedTitle,
                description: description.trim(),
                artwork: finalArtwork,
                coverImg: finalArtwork,
            });
            toast.success("歌单信息已更新");
            hideModal();
        } catch (e) {
            console.log(e);
            toast.warn("保存歌单信息失败");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Base defaultClose>
            <div className="modal--edit-music-sheet shadow backdrop-color">
                <Base.Header>编辑歌单信息</Base.Header>

                <div className="edit-sheet-content">
                    <div className="edit-sheet-form">
                        <label className="form-row">
                            <span className="form-label">名称：</span>
                            <div className="field-wrapper">
                                <input
                                    autoFocus
                                    value={title}
                                    maxLength={CommonConst.NEW_SHEET_NAME_LENGTH_LIMIT}
                                    onChange={(e) => {
                                        setTitle(
                                            e.currentTarget.value.slice(
                                                0,
                                                CommonConst.NEW_SHEET_NAME_LENGTH_LIMIT,
                                            ),
                                        );
                                    }}
                                    placeholder="请输入歌单名称"
                                ></input>
                                <span className="count">
                                    {title.length}/{CommonConst.NEW_SHEET_NAME_LENGTH_LIMIT}
                                </span>
                            </div>
                        </label>

                        <label className="form-row desc-row">
                            <span className="form-label">简介：</span>
                            <div className="field-wrapper textarea-wrapper">
                                <textarea
                                    value={description}
                                    maxLength={DESCRIPTION_LIMIT}
                                    onChange={(e) => {
                                        setDescription(
                                            e.currentTarget.value.slice(0, DESCRIPTION_LIMIT),
                                        );
                                    }}
                                    placeholder="给歌单添加一段简介"
                                ></textarea>
                                <span className="count">{description.length}</span>
                            </div>
                        </label>
                    </div>

                    <div
                        className="cover-editor"
                        role="button"
                        title="替换图片"
                        onClick={selectCover}
                    >
                        <img
                            src={previewArtwork || albumImg}
                            draggable={false}
                            onError={setFallbackAlbum}
                        ></img>
                        <div className="cover-mask">替换图片</div>
                    </div>
                </div>

                <div className="edit-sheet-footer">
                    <div
                        role="button"
                        data-type="normalButton"
                        onClick={() => {
                            hideModal();
                        }}
                    >
                        取消
                    </div>
                    <div
                        role="button"
                        data-type="primaryButton"
                        data-disabled={!canSave}
                        onClick={saveSheetInfo}
                    >
                        {saving ? "保存中..." : "保存"}
                    </div>
                </div>
            </div>
        </Base>
    );
}
