import AppHeader from "./components/Header";

import "./app.scss";
import MusicBar from "./components/MusicBar";
import { Outlet } from "react-router";
import PanelComponent from "./components/Panel";
import MusicDetail from "@renderer/components/MusicDetail";

export default function App() {
    return (
        <div className="app-container">
            <div className="app-backdrop">
                <div className="app-backdrop-grid"></div>
                <div className="app-backdrop-scan"></div>
            </div>
            <div className="app-shell">
                <AppHeader></AppHeader>
                <div className="body-container">
                    <div className="workspace-shell">
                        <Outlet></Outlet>
                        <PanelComponent></PanelComponent>
                    </div>
                </div>
                <MusicDetail></MusicDetail>
                <MusicBar></MusicBar>
            </div>
        </div>
    );
}
