import AnimatedDiv from "../AnimatedDiv";
import "./index.scss";
import albumImg from "@/assets/imgs/album-cover.jpg";
import Tag from "../Tag";
import { setFallbackAlbum } from "@/renderer/utils/img-on-error";
import Header from "./widgets/Header";
import Lyric from "./widgets/Lyric";
import Condition from "../Condition";
import { useTranslation } from "react-i18next";
import { useCurrentMusic } from "@renderer/core/track-player/hooks";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PluginManager from "@shared/plugin-manager/renderer";
import { localPluginName } from "@/common/constant";
import { toast } from "react-toastify";
import { musicDetailShownStore } from "@renderer/components/MusicDetail/store";


function firstValidValue(...values: any[]) {
    return values.find(
        (value) => value !== undefined && value !== null && value !== "",
    );
}

function getArtistFromMusicItem(
    musicItem: IMusic.IMusicItem,
): IArtist.IArtistItem | null {
    if (!musicItem || musicItem.platform === localPluginName) {
        return null;
    }

    const raw = musicItem.$raw ?? musicItem.$ ?? {};
    const artistItem = firstValidValue(
        musicItem.artistItem,
        musicItem.artistInfo,
        raw.artistItem,
        raw.artistInfo,
    );
    const rawArtist = firstValidValue(
        raw.artist,
        raw.ar?.[0],
        raw.artists?.[0],
        raw.singers?.[0],
        raw.singer?.[0],
        musicItem.artists?.[0],
        musicItem.singers?.[0],
        musicItem.singer?.[0],
    );
    const artistId = firstValidValue(
        artistItem?.id,
        rawArtist?.id,
        musicItem.artistId,
        musicItem.artistid,
        musicItem.artistID,
        musicItem.singerId,
        musicItem.singerid,
        musicItem.singerID,
        musicItem.singerMID,
        musicItem.authorId,
        raw.artistId,
        raw.artistid,
        raw.artistID,
        raw.singerId,
        raw.singerid,
        raw.singerID,
        raw.singerMID,
        raw.authorId,
    );

    if (!artistId) {
        return null;
    }

    return {
        ...(artistItem ?? rawArtist ?? {}),
        id: `${artistId}`,
        name:
            firstValidValue(
                artistItem?.name,
                artistItem?.title,
                rawArtist?.name,
                rawArtist?.title,
                rawArtist?.singerName,
                musicItem.artist,
            ) ?? "\u672a\u77e5\u6b4c\u624b",
        platform: musicItem.platform,
        avatar: firstValidValue(
            artistItem?.avatar,
            rawArtist?.avatar,
            rawArtist?.picUrl,
            rawArtist?.singerPic,
            "",
        ),
    } as IArtist.IArtistItem;
}

function getAlbumFromMusicItem(
    musicItem: IMusic.IMusicItem,
): IAlbum.IAlbumItem | null {
    if (!musicItem || musicItem.platform === localPluginName) {
        return null;
    }

    const raw = musicItem.$raw ?? musicItem.$ ?? {};
    const albumItem = firstValidValue(
        musicItem.albumItem,
        musicItem.albumInfo,
        raw.albumItem,
        raw.albumInfo,
    );
    const rawAlbum = firstValidValue(raw.album, raw.al, musicItem.al);
    const albumId = firstValidValue(
        albumItem?.id,
        rawAlbum?.id,
        musicItem.albumId,
        musicItem.albumid,
        musicItem.albumID,
        raw.albumId,
        raw.albumid,
        raw.albumID,
    );

    if (!albumId) {
        return null;
    }

    return {
        ...(albumItem ?? rawAlbum ?? {}),
        id: `${albumId}`,
        title:
            firstValidValue(
                albumItem?.title,
                albumItem?.name,
                rawAlbum?.title,
                rawAlbum?.name,
                musicItem.album,
            ) ?? "\u672a\u77e5\u4e13\u8f91",
        artist: firstValidValue(albumItem?.artist, musicItem.artist),
        artwork: firstValidValue(
            albumItem?.artwork,
            rawAlbum?.artwork,
            rawAlbum?.picUrl,
            musicItem.artwork,
        ),
        albumMID: firstValidValue(
            albumItem?.albumMID,
            musicItem.albumMID,
            musicItem.albummid,
            raw.albumMID,
            raw.albummid,
        ),
        albummid: firstValidValue(
            albumItem?.albummid,
            musicItem.albummid,
            raw.albummid,
        ),
        description: albumItem?.description ?? "",
        platform: musicItem.platform,
    } as IAlbum.IAlbumItem;
}

async function searchArtistFromMusicItem(musicItem: IMusic.IMusicItem) {
    const artistName = musicItem.artist?.trim();
    if (!artistName || musicItem.platform === localPluginName) {
        return null;
    }

    const result = (await PluginManager.callPluginDelegateMethod(
        musicItem,
        "search",
        artistName,
        1,
        "artist",
    )) as any;
    const artists = result?.data ?? [];
    const matched =
        artists.find((item: IArtist.IArtistItem) => item.name === artistName) ??
        artists[0];
    return matched
        ? ({
            ...matched,
            platform: matched.platform ?? musicItem.platform,
        } as IArtist.IArtistItem)
        : null;
}

async function searchAlbumFromMusicItem(musicItem: IMusic.IMusicItem) {
    const albumName = musicItem.album?.trim();
    if (!albumName || musicItem.platform === localPluginName) {
        return null;
    }

    const result = (await PluginManager.callPluginDelegateMethod(
        musicItem,
        "search",
        albumName,
        1,
        "album",
    )) as any;
    const albums = result?.data ?? [];
    const matched =
        albums.find(
            (item: IAlbum.IAlbumItem) =>
                item.title === albumName &&
                (!musicItem.artist ||
                    !item.artist ||
                    item.artist.includes(musicItem.artist) ||
                    musicItem.artist.includes(item.artist)),
        ) ??
        albums.find((item: IAlbum.IAlbumItem) => item.title === albumName) ??
        albums[0];
    return matched
        ? ({
            ...matched,
            platform: matched.platform ?? musicItem.platform,
        } as IAlbum.IAlbumItem)
        : null;
}

export const isMusicDetailShown = musicDetailShownStore.getValue;
export const useMusicDetailShown = musicDetailShownStore.useValue;

function MusicDetail() {
    const musicItem = useCurrentMusic();
    const musicDetailShown = musicDetailShownStore.useValue();

    const { t } = useTranslation();
    const navigate = useNavigate();
    const artistName = musicItem?.artist?.trim();
    const albumName = musicItem?.album?.trim();
    const artistItem = musicItem ? getArtistFromMusicItem(musicItem) : null;
    const albumItem = musicItem ? getAlbumFromMusicItem(musicItem) : null;
    const canOpenArtist = !!musicItem && !!artistName && (
        !!artistItem ||
        (musicItem.platform !== localPluginName &&
            PluginManager.isSupportFeatureMethod(musicItem.platform, "search"))
    );
    const canOpenAlbum = !!musicItem && !!albumName && (
        !!albumItem ||
        (musicItem.platform !== localPluginName &&
            PluginManager.isSupportFeatureMethod(musicItem.platform, "search"))
    );

    async function goArtist() {
        if (!musicItem || !artistName || !canOpenArtist) {
            return;
        }
        try {
            const targetArtist = artistItem ?? await searchArtistFromMusicItem(musicItem);
            if (!targetArtist) {
                toast.info(t("media.unknown_artist"));
                return;
            }
            musicDetailShownStore.setValue(false);
            navigate(
                `/main/artist/${encodeURIComponent(targetArtist.platform)}/${encodeURIComponent(targetArtist.id)}`,
                {
                    state: {
                        artistItem: targetArtist,
                    },
                },
            );
        } catch {
            toast.info(t("media.unknown_artist"));
        }
    }

    async function goAlbum() {
        if (!musicItem || !albumName || !canOpenAlbum) {
            return;
        }
        try {
            const targetAlbum = albumItem ?? await searchAlbumFromMusicItem(musicItem);
            if (!targetAlbum) {
                toast.info(t("media.unknown_album"));
                return;
            }
            musicDetailShownStore.setValue(false);
            navigate(
                `/main/album/${encodeURIComponent(targetAlbum.platform)}/${encodeURIComponent(targetAlbum.id)}`,
                {
                    state: {
                        albumItem: targetAlbum,
                    },
                },
            );
        } catch {
            toast.info(t("media.unknown_album"));
        }
    }

    useEffect(() => {
        const escHandler = (evt: KeyboardEvent) => {
            if (evt.code === "Escape") {
                evt.preventDefault();
                musicDetailShownStore.setValue(false);
            }
        };
        window.addEventListener("keydown", escHandler);

        return () => {
            window.removeEventListener("keydown", escHandler);
        };
    }, []);


    return (
        <AnimatedDiv
            showIf={musicDetailShown}
            className="music-detail--container animate__animated background-color"
            mountClassName="animate__slideInUp"
            unmountClassName="animate__slideOutDown"
            onAnimationEnd={() => {
                // hack logic: https://github.com/electron/electron/issues/32341
                // force reflow to refresh drag region
                setTimeout(() => {
                    document.body.style.width = "0";
                    document.body.getBoundingClientRect();
                    document.body.style.width = "";
                }, 200);
            }}
        >
            <div
                className="music-detail-background"
                style={{
                    backgroundImage: `url(${musicItem?.artwork ?? albumImg})`,
                }}
            ></div>
            <Header></Header>
            <div className="music-title" title={musicItem?.title}>
                {musicItem?.title || t("media.unknown_title")}
            </div>
            <div className="music-info">
                <span>
                    <Condition condition={artistName}>
                        <button
                            type="button"
                            className="music-info-link"
                            title={canOpenArtist ? "\u67e5\u770b\u6b4c\u624b" : undefined}
                            data-clickable={canOpenArtist}
                            disabled={!canOpenArtist}
                            onClick={goArtist}
                        >
                            {artistName}
                        </button>
                    </Condition>
                    <Condition condition={albumName}>
                        <span className="music-info-separator"> - </span>
                        <button
                            type="button"
                            className="music-info-link"
                            title={canOpenAlbum ? "\u67e5\u770b\u4e13\u8f91" : undefined}
                            data-clickable={canOpenAlbum}
                            disabled={!canOpenAlbum}
                            onClick={goAlbum}
                        >
                            {albumName}
                        </button>
                    </Condition>
                </span>
                {musicItem?.platform ? <Tag fill>{musicItem.platform}</Tag> : null}
            </div>
            <div className="music-body">
                <div className="music-album-options">
                    <img
                        className="music-album shadow"
                        onError={setFallbackAlbum}
                        src={musicItem?.artwork ?? albumImg}
                    ></img>
                </div>

                <Lyric></Lyric>
            </div>
        </AnimatedDiv>
    );
}

MusicDetail.show = () => {
    musicDetailShownStore.setValue(true);
};

MusicDetail.hide = () => {
    musicDetailShownStore.setValue(false);
};

export default MusicDetail;
