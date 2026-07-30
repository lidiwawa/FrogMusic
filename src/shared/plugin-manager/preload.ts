import { contextBridge, ipcRenderer } from "electron";

ipcRenderer.on("@/shared/plugin-manager/sync-plugins", (_evt, newPlugins) => {
    pluginUpdateCallback?.(newPlugins);
});

let pluginUpdateCallback: (plugins: IPlugin.IPluginDelegate[]) => void;

function onPluginUpdated(callback: (plugins: IPlugin.IPluginDelegate[]) => void) {
    pluginUpdateCallback = callback;
}


interface IPluginDelegateLike {
    platform?: string;
    hash?: string;
}

async function callPluginMethod<
    T extends keyof IPlugin.IPluginInstanceMethods,
>(
    pluginDelegate: IPluginDelegateLike,
    method: T,
    ...args: Parameters<IPlugin.IPluginInstanceMethods[T]>
) {
    return (await ipcRenderer.invoke("@shared/plugin-manager/call-plugin-method", {
        hash: pluginDelegate.hash,
        platform: pluginDelegate.platform,
        method,
        args,
    })) as ReturnType<IPlugin.IPluginInstanceMethods[T]>;
}

async function reloadPlugins() {
    const result = await ipcRenderer.invoke("@shared/plugin-manager/load-all-plugins");
    pluginUpdateCallback?.(result);
}

async function uninstallPlugin(hash: string) {
    await ipcRenderer.invoke("@shared/plugin-manager/uninstall-plugin", hash);
}

async function updateAllPlugins() {
    ipcRenderer.emit("@shared/plugin-manager/update-all-plugins");
}

async function installPluginFromRemote(url: string) {
    return await ipcRenderer.invoke("@shared/plugin-manager/install-plugin-remote", url);
}

async function installPluginFromLocal(url: string) {
    return await ipcRenderer.invoke("@shared/plugin-manager/install-plugin-local", url);
}

async function loginPlatform(platform: string) {
    return await ipcRenderer.invoke("plugin-login", platform);
}

async function getUserPlaylists(platform: string) {
    return await ipcRenderer.invoke("plugin-get-user-playlists", platform);
}

async function getNeteaseRecommendations() {
    return await ipcRenderer.invoke("plugin-get-netease-recommendations");
}

async function importPlaylists(platform: string, playlistIds: string[]) {
    return await ipcRenderer.invoke("plugin-import-playlists", platform, playlistIds);
}

const mod = {
    onPluginUpdated,
    callPluginMethod,
    reloadPlugins,
    uninstallPlugin,
    updateAllPlugins,
    installPluginFromLocal,
    installPluginFromRemote,
    loginPlatform,
    getUserPlaylists,
    getNeteaseRecommendations,
    importPlaylists,
};

contextBridge.exposeInMainWorld("@shared/plugin-manager", mod);
