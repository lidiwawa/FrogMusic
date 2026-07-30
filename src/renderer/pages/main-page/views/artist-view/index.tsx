import { useParams } from "react-router-dom";
import Header from "./components/Header";
import "./index.scss";
import { useEffect, useMemo, useState } from "react";
import PluginManager from "@shared/plugin-manager/renderer";
import { localPluginName } from "@/common/constant";
import Body from "./components/Body";
import { initQueryResult, queryResultStore } from "./store";

export default function ArtistView() {
    const params = useParams();

    const artistItem = useMemo(() => {
        const artistInState = history.state.usr?.artistItem ?? {};

        return {
            ...artistInState,
            platform: params?.platform,
            id: params?.id,
        } as IArtist.IArtistItem;
    }, [params?.platform, params?.id]);
    const [artistDetail, setArtistDetail] = useState<IArtist.IArtistItem | null>(null);
    const artistDetailFromWorks = queryResultStore.useValue().artistDetail;
    const displayArtistItem = artistDetailFromWorks ?? artistDetail ?? artistItem;

    useEffect(() => {
        setArtistDetail(null);
        let cancelled = false;
        const artistName = artistItem?.name?.trim();
        if (
            artistName &&
            !artistItem?.description &&
            artistItem?.platform &&
            artistItem.platform !== localPluginName &&
            PluginManager.isSupportFeatureMethod(artistItem.platform, "search")
        ) {
            PluginManager.callPluginDelegateMethod(
                artistItem,
                "search",
                artistName,
                1,
                "artist",
            ).then((result: any) => {
                if (cancelled) {
                    return;
                }
                const artists = result?.data ?? [];
                const matched =
                    artists.find((item: IArtist.IArtistItem) => `${item.id}` === `${artistItem.id}`) ??
                    artists.find((item: IArtist.IArtistItem) => item.name === artistName) ??
                    artists[0];
                if (matched) {
                    setArtistDetail({
                        ...artistItem,
                        ...matched,
                        id: `${matched.id ?? artistItem.id}`,
                        platform: matched.platform ?? artistItem.platform,
                    } as IArtist.IArtistItem);
                }
            }).catch(() => undefined);
        }
        return () => {
            cancelled = true;
        };
    }, [artistItem?.id, artistItem?.platform, artistItem?.name, artistItem?.description]);

    useEffect(() => {
        return () => {
            queryResultStore.setValue(initQueryResult);
        };
    }, []);

    return (
        <div id="page-container" className="page-container artist-view--container">
            <Header artistItem={displayArtistItem}></Header>
            <Body artistItem={displayArtistItem}></Body>
        </div>
    );
}
