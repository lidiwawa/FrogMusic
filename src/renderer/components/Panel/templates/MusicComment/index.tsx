import Base from "@renderer/components/Panel/templates/Base";
import "./index.scss";
import SvgAsset from "@renderer/components/SvgAsset";
import dayjs from "dayjs";
import useComment from "@renderer/components/Panel/templates/MusicComment/useComment";
import { RequestStateCode } from "@/common/constant";
import BottomLoadingState from "@renderer/components/BottomLoadingState";
import Empty from "@renderer/components/Empty";
import { hidePanel } from "@renderer/components/Panel";
import albumImg from "@/assets/imgs/album-cover.jpg";
import { useState } from "react";
import { toast } from "react-toastify";

interface IProps {
    coverHeader?: boolean;
    musicItem?: IMusic.IMusicItem;
}

export default function MusicComment(props: IProps) {
    const { coverHeader, musicItem } = props;

    const [comments, reqState, loadMore, canLoadComment, refreshComments, errorText] = useComment(musicItem);
    const isLoading = !!(reqState & RequestStateCode.LOADING);
    const isFirstLoading = comments.length === 0 && isLoading;
    const hasError = reqState === RequestStateCode.ERROR;
    const refreshDisabled = !musicItem || !canLoadComment || isLoading;
    const titleExtra = comments.length > 0
        ? `\u5df2\u52a0\u8f7d ${comments.length} \u6761`
        : isLoading
            ? "\u6b63\u5728\u52a0\u8f7d"
            : hasError
                ? "\u52a0\u8f7d\u5931\u8d25"
                : "";
    const musicTitle = musicItem
        ? `${musicItem.title ?? "\u672a\u77e5\u6b4c\u66f2"}${musicItem.artist ? ` - ${musicItem.artist}` : ""}`
        : "";

    return <Base
        coverHeader={coverHeader}
        defaultClose={false}
        width={540}
    >
        <div className="music-comment-panel--title-container">
            <div className="music-comment-panel--title-main">
                <div className="music-comment-panel--title-row">
                    <span>{"\u8bc4\u8bba"}</span>
                    {titleExtra ? (
                        <span className="music-comment-panel--title-extra">
                            {titleExtra}
                        </span>
                    ) : null}
                </div>
                {musicTitle ? (
                    <div
                        className="music-comment-panel--subtitle"
                        title={musicTitle}
                    >
                        {musicTitle}
                    </div>
                ) : null}
            </div>
            <button
                type="button"
                className="music-comment-panel--action-button"
                title="\u5237\u65b0\u8bc4\u8bba"
                data-disabled={refreshDisabled}
                disabled={refreshDisabled}
                onClick={() => {
                    if (!refreshDisabled) {
                        refreshComments();
                    }
                }}
            >
                <SvgAsset iconName="repeat-song" size={18}></SvgAsset>
                <span>{"\u5237\u65b0"}</span>
            </button>
            <button
                type="button"
                className="music-comment-panel--action-button music-comment-panel--close-button"
                title="\u5173\u95ed\u8bc4\u8bba"
                onClick={() => {
                    hidePanel();
                }}
            >
                <SvgAsset iconName="x-mark" size={18}></SvgAsset>
                <span>{"\u5173\u95ed"}</span>
            </button>
        </div>
        <div className="music-comment-panel--body-container">
            {!musicItem ? (
                <CommentState
                    title="\u6682\u672a\u9009\u62e9\u6b4c\u66f2"
                    description="\u64ad\u653e\u6216\u9009\u4e2d\u4e00\u9996\u6b4c\u540e\u518d\u67e5\u770b\u8bc4\u8bba"
                ></CommentState>
            ) : !canLoadComment ? (
                <CommentState
                    title="\u5f53\u524d\u63d2\u4ef6\u4e0d\u652f\u6301\u8bc4\u8bba"
                    description={errorText || "\u9700\u8981\u63d2\u4ef6\u5b9e\u73b0 getMusicComments \u80fd\u529b\u540e\u624d\u80fd\u67e5\u770b"}
                ></CommentState>
            ) : isFirstLoading ? (
                <CommentSkeleton></CommentSkeleton>
            ) : comments.length === 0 && hasError ? (
                <CommentState
                    title="\u8bc4\u8bba\u52a0\u8f7d\u5931\u8d25"
                    description={errorText || "\u53ef\u80fd\u662f\u63d2\u4ef6\u63a5\u53e3\u5931\u6548\u3001\u672a\u767b\u5f55\u6216\u7f51\u7edc\u5f02\u5e38"}
                    actionText="\u91cd\u8bd5"
                    onAction={() => {
                        loadMore(true);
                    }}
                ></CommentState>
            ) : (
                <>
                    {hasError && comments.length > 0 ? (
                        <div className="music-comment-panel--inline-error">
                            <SvgAsset iconName="question-mark-circle" size={16}></SvgAsset>
                            <span>{errorText || "\u540e\u7eed\u8bc4\u8bba\u52a0\u8f7d\u5931\u8d25\uff0c\u5df2\u4fdd\u7559\u5f53\u524d\u5df2\u52a0\u8f7d\u5185\u5bb9"}</span>
                            <button
                                type="button"
                                onClick={() => {
                                    loadMore();
                                }}
                            >
                                {"\u91cd\u8bd5"}
                            </button>
                        </div>
                    ) : null}
                    {comments.map((comment) => (
                        <MusicCommentItem
                            comment={comment}
                            key={`${comment.id ?? comment.nickName ?? comment.comment}-${comment.createAt ?? 0}`}
                        ></MusicCommentItem>
                    ))}
                    {comments.length === 0 ? (
                        <CommentState
                            title="\u6682\u65e0\u8bc4\u8bba"
                            description="\u5f53\u524d\u63d2\u4ef6\u6ca1\u6709\u8fd4\u56de\u8bc4\u8bba\u6570\u636e"
                            actionText="\u5237\u65b0"
                            onAction={() => {
                                refreshComments();
                            }}
                        ></CommentState>
                    ) : (
                        <BottomLoadingState
                            state={reqState}
                            onLoadMore={loadMore}
                            autoLoadMore
                        ></BottomLoadingState>
                    )}
                </>
            )}
        </div>
    </Base>;
}

interface ICommentStateProps {
    title: string;
    description?: string;
    actionText?: string;
    onAction?: () => void;
}

function CommentState(props: ICommentStateProps) {
    const { title, description, actionText, onAction } = props;

    return <div className="music-comment-panel--state">
        <Empty style={{ minHeight: "120px" }}>
            <div className="music-comment-panel--state-title">{title}</div>
            {description ? (
                <div className="music-comment-panel--state-description">
                    {description}
                </div>
            ) : null}
        </Empty>
        {actionText && onAction ? (
            <button
                type="button"
                data-type="normalButton"
                className="music-comment-panel--state-action"
                onClick={onAction}
            >
                {actionText}
            </button>
        ) : null}
    </div>;
}

function CommentSkeleton() {
    return <div className="music-comment-panel--skeleton-list">
        {Array.from({ length: 5 }).map((_, index) => (
            <div className="music-comment-panel--skeleton-item" key={index}>
                <div className="skeleton-avatar"></div>
                <div className="skeleton-content">
                    <div className="skeleton-line skeleton-line-short"></div>
                    <div className="skeleton-line"></div>
                    <div className="skeleton-line skeleton-line-mid"></div>
                </div>
            </div>
        ))}
    </div>;
}

interface IMusicCommentItemProps {
    comment: IComment.IComment;
}

function formatLikeCount(value?: number) {
    if (typeof value !== "number") {
        return "-";
    }
    if (value >= 10000) {
        const fixed = value >= 100000 ? 0 : 1;
        return `${(value / 10000).toFixed(fixed)}\u4e07`;
    }
    return `${value}`;
}

function MusicCommentItem(props: IMusicCommentItemProps) {
    const { comment } = props;
    const [expanded, setExpanded] = useState(false);
    const commentText = comment.comment ?? "";
    const needFold = commentText.length > 120;
    const createAtText = comment.createAt
        ? dayjs(comment.createAt).format("YYYY-MM-DD HH:mm")
        : "";

    async function copyComment() {
        if (!commentText) {
            return;
        }
        await navigator.clipboard.writeText(commentText);
        toast.success("\u5df2\u590d\u5236\u8bc4\u8bba");
    }

    return <div className="music-comment-panel--comment-item-container">
        <div className="comment-title-container">
            <img className="avatar"
                src={comment.avatar || albumImg}
                onError={(e) => {
                    e.currentTarget.src = albumImg;
                }}></img>
            <span title={comment.nickName}>{comment.nickName || "\u533f\u540d\u7528\u6237"}</span>
        </div>
        <div
            className="comment-body-container"
            data-expanded={expanded}
            data-foldable={needFold}
        >
            <span>{commentText || "\u8be5\u8bc4\u8bba\u6682\u65e0\u5185\u5bb9"}</span>
            {needFold ? (
                <button
                    type="button"
                    className="comment-expand-button"
                    onClick={() => {
                        setExpanded((prev) => !prev);
                    }}
                >
                    {expanded ? "\u6536\u8d77" : "\u5c55\u5f00"}
                </button>
            ) : null}
        </div>
        <div className="comment-operations-container">
            <div className="comment-meta">
                {createAtText ? <span title={createAtText}>{createAtText}</span> : null}
                {comment.location ? <span>{`IP\u5c5e\u5730 ${comment.location}`}</span> : null}
            </div>
            <div className="thumb-up" title="\u70b9\u8d5e\u6570">
                <SvgAsset iconName="hand-thumb-up"></SvgAsset>
                <span>{formatLikeCount(comment.like)}</span>
            </div>
            <button
                type="button"
                className="comment-copy-button"
                onClick={copyComment}
            >
                {"\u590d\u5236"}
            </button>
        </div>
    </div>;
}
