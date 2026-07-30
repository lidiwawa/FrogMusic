import Slider from "./widgets/Slider";
import MusicInfo from "./widgets/MusicInfo";
import Controller from "./widgets/Controller";
import Extra from "./widgets/Extra";

import "./index.scss";

export default function MusicBar() {
    return (
        <div className="music-bar-container">
            <div className="music-bar-track">
                <Slider></Slider>
            </div>
            <div className="music-bar-body">
                <div className="music-bar-body__section music-bar-body__section--info">
                    <MusicInfo></MusicInfo>
                </div>
                <div className="music-bar-body__section music-bar-body__section--controls">
                    <Controller></Controller>
                </div>
                <div className="music-bar-body__section music-bar-body__section--extra">
                    <Extra></Extra>
                </div>
            </div>
        </div>
    );
}
