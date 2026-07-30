import { useEffect, useRef, useState } from "react";
import { RequestStateCode } from "@/common/constant";
import PluginManager from "@shared/plugin-manager/renderer";

export default function useComment(musicItem?: IMusic.IMusicItem) {
    const [comments, setComments] = useState<IComment.IComment[]>([]);
    const [requestStateCode, setRequestStateCode] = useState(RequestStateCode.IDLE);
    const [canLoadComment, setCanLoadComment] = useState(true);
    const [errorText, setErrorText] = useState("");
    const pageRef = useRef(1);
    const commentsRef = useRef<IComment.IComment[]>([]);
    const canLoadCommentRef = useRef(true);
    const requestStateCodeRef = useRef(RequestStateCode.IDLE);
    requestStateCodeRef.current = requestStateCode;
    commentsRef.current = comments;

    const loadMore = async (reset = false) => {
        const shouldReset = reset === true;
        try {
            if (!musicItem || !canLoadCommentRef.current) {
                return;
            }
            if (requestStateCodeRef.current & RequestStateCode.LOADING) {
                return;
            }
            const nextPage = shouldReset ? 1 : pageRef.current;
            if (shouldReset) {
                pageRef.current = 1;
                commentsRef.current = [];
                setComments([]);
            }
            setErrorText("");
            setRequestStateCode(
                !shouldReset && commentsRef.current.length > 0
                    ? RequestStateCode.PENDING_REST_PAGE
                    : RequestStateCode.PENDING_FIRST_PAGE,
            );
            const response = await PluginManager.callPluginDelegateMethod(musicItem, "getMusicComments", musicItem, nextPage);
            const responseData = Array.isArray(response?.data) ? response.data : [];

            setComments(prev => {
                const nextComments = shouldReset
                    ? responseData
                    : prev.concat(responseData);
                commentsRef.current = nextComments;
                return nextComments;
            });
            if (response?.isEnd === false) {
                setRequestStateCode(RequestStateCode.PARTLY_DONE);
                pageRef.current = nextPage + 1;
            } else {
                setRequestStateCode(RequestStateCode.FINISHED);
            }
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : typeof error === "string"
                    ? error
                    : "";
            setErrorText(message || "评论加载失败，可能是插件接口失效、未登录或网络异常");
            setRequestStateCode(RequestStateCode.ERROR);
        }
    };


    useEffect(() => {
        pageRef.current = 1;
        commentsRef.current = [];
        setComments([]);
        if (!musicItem) {
            canLoadCommentRef.current = false;
            setCanLoadComment(false);
            setErrorText("");
            setRequestStateCode(RequestStateCode.IDLE);
            return;
        }

        const supported = PluginManager.isSupportFeatureMethod(
            musicItem.platform,
            "getMusicComments",
        );
        canLoadCommentRef.current = supported;
        setCanLoadComment(supported);
        if (!supported) {
            setErrorText("当前平台插件暂不支持查看评论");
            requestStateCodeRef.current = RequestStateCode.ERROR;
            setRequestStateCode(RequestStateCode.ERROR);
            return;
        }

        setErrorText("");
        requestStateCodeRef.current = RequestStateCode.IDLE;
        setRequestStateCode(RequestStateCode.IDLE);
        loadMore(true);
    }, [musicItem?.id, musicItem?.platform]);


    return [comments, requestStateCode, loadMore, canLoadComment, () => loadMore(true), errorText] as const;
}
