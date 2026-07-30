import AppConfig from "@shared/app-config/renderer";

import "./index.scss";
import { CSSProperties, ReactNode, useState } from "react";
import Condition, { IfTruthy } from "@/renderer/components/Condition";
import { hideModal, showModal } from "@/renderer/components/Modal";
import Empty from "@/renderer/components/Empty";
import { toast } from "react-toastify";
import { showPanel } from "@/renderer/components/Panel";
import DragReceiver, { startDrag } from "@/renderer/components/DragReceiver";
import { produce } from "immer";
import { i18n } from "@/shared/i18n/renderer";
import PluginManager, {
  useSortedPlugins,
} from "@shared/plugin-manager/renderer";
import MusicSheet from "@/renderer/core/music-sheet";

const t = i18n.t;

type AccountSyncPlatform = "qq" | "netease";

type PlaylistSyncState =
  | {
      status: "idle";
    }
  | {
      status: "syncing";
      message: string;
    }
  | {
      status: "success" | "empty" | "error";
      message: string;
      imported: number;
      failed: number;
      total: number;
      importedItems: Array<{
        title: string;
        count: number;
      }>;
      failedItems: string[];
    };

function getAccountSyncPlatform(platform?: string): AccountSyncPlatform | null {
  const rawPlatform = platform ?? "";
  const normalizedPlatform = rawPlatform.toLowerCase();

  if (rawPlatform === "QQ音乐" || normalizedPlatform.includes("qq")) {
    return "qq";
  }
  if (
    rawPlatform === "网易云" ||
    rawPlatform.includes("网易") ||
    normalizedPlatform.includes("netease")
  ) {
    return "netease";
  }
  return null;
}

function isAccountSyncPlugin(row: IPlugin.IPluginDelegate) {
  return Boolean(getAccountSyncPlatform(row.platform));
}

const capabilityDefinitions = [
  {
    label: "搜索",
    enabled: (plugin: IPlugin.IPluginDelegate) =>
      plugin.supportedMethod.includes("search"),
  },
  {
    label: "播放",
    enabled: (plugin: IPlugin.IPluginDelegate) =>
      plugin.supportedMethod.includes("getMediaSource"),
  },
  {
    label: "下载",
    enabled: (plugin: IPlugin.IPluginDelegate) =>
      plugin.supportedMethod.includes("getMediaSource"),
  },
  {
    label: "歌词",
    enabled: (plugin: IPlugin.IPluginDelegate) =>
      plugin.supportedMethod.includes("getLyric"),
  },
  {
    label: "评论",
    enabled: (plugin: IPlugin.IPluginDelegate) =>
      plugin.supportedMethod.includes("getMusicComments"),
  },
  {
    label: "歌单",
    enabled: (plugin: IPlugin.IPluginDelegate) =>
      plugin.supportedMethod.includes("importMusicSheet") ||
      plugin.supportedMethod.includes("getMusicSheetInfo") ||
      plugin.supportedMethod.includes("getRecommendSheetsByTag"),
  },
  {
    label: "登录",
    enabled: (plugin: IPlugin.IPluginDelegate) => isAccountSyncPlugin(plugin),
  },
  {
    label: "同步",
    enabled: (plugin: IPlugin.IPluginDelegate) =>
      isAccountSyncPlugin(plugin) &&
      plugin.supportedMethod.includes("importMusicSheet"),
  },
];

function PluginCapabilityTags(props: { plugin: IPlugin.IPluginDelegate }) {
  const { plugin } = props;
  return (
    <div className="plugin-table--capabilities" title="插件能力">
      {capabilityDefinitions.map((item) => {
        const enabled = item.enabled(plugin);
        return (
          <span
            key={item.label}
            className="plugin-table--capability-tag"
            data-enabled={enabled}
          >
            {item.label}
          </span>
        );
      })}
    </div>
  );
}

async function syncUserPlaylists(row: IPlugin.IPluginDelegate) {
  const platformKey = getAccountSyncPlatform(row.platform);
  if (!platformKey) {
    throw new Error(`Unsupported platform: ${row.platform}`);
  }

  await MusicSheet.frontend.setupMusicSheets();

  const result = await PluginManager.getUserPlaylists(platformKey);
  const playlists = result.playlists ?? [];

  if (!result.success) {
    throw new Error(result.reason ?? t("plugin.sync_failed"));
  }
  console.info(
    `[playlist-sync] ${row.platform}: fetched ${playlists.length} playlists`,
  );

  if (playlists.length === 0) {
    return {
      imported: 0,
      failed: 0,
      failedItems: [],
      importedItems: [],
      total: 0,
    };
  }

  let imported = 0;
  let failed = 0;
  const failedItems: string[] = [];
  const importedSheets: Array<{
    title: string;
    count: number;
  }> = [];

  for (const playlist of playlists) {
    const playlistTitle = playlist.title?.trim() || playlist.id;
    const title = `${row.platform} - ${playlistTitle}`;
    try {
      const importedItems = (await PluginManager.callPluginDelegateMethod(
        row,
        "importMusicSheet",
        playlist.id,
      )) as IMusic.IMusicItem[] | null;
      const musicItems = Array.isArray(importedItems)
        ? importedItems.filter(Boolean)
        : [];

      if (!musicItems.length) {
        failed++;
        failedItems.push(`${playlistTitle}: 0`);
        console.warn(
          `[playlist-sync] ${row.platform}: empty import for ${playlistTitle}`,
        );
        continue;
      }

      let localSheet = MusicSheet.frontend
        .getAllSheets()
        .find((sheet) => sheet.title === title);

      if (!localSheet) {
        localSheet = await MusicSheet.frontend.addSheet(title);
      } else {
        await MusicSheet.frontend.clearSheet(localSheet.id);
      }

      if (!localSheet) {
        failed++;
        failedItems.push(`${playlistTitle}: create sheet failed`);
        continue;
      }

      await MusicSheet.frontend.addMusicToSheet(musicItems, localSheet.id);
      console.info(
        `[playlist-sync] ${row.platform}: imported ${musicItems.length} songs from ${playlistTitle}`,
      );
      imported++;
      importedSheets.push({
        title: playlistTitle,
        count: musicItems.length,
      });
    } catch (e) {
      console.warn(
        `[playlist-sync] ${row.platform}: failed to sync ${playlistTitle}`,
        e,
      );
      failed++;
      failedItems.push(`${playlistTitle}: ${e?.message ?? "unknown error"}`);
    }
  }

  return {
    imported,
    failed,
    failedItems,
    importedItems: importedSheets,
    total: playlists.length,
  };
}

function PluginActions(props: { row: IPlugin.IPluginDelegate }) {
  const { row } = props;
  const [syncState, setSyncState] = useState<PlaylistSyncState>({
    status: "idle",
  });
  const isSyncing = syncState.status === "syncing";

  return (
    <div className="plugin-actions">
      <div className="plugin-actions-group">
        <div className="plugin-actions-group-title">{"\u5e38\u7528"}</div>
        <div className="plugin-actions-group-items">
          <Condition
            condition={row.supportedMethod.includes("importMusicItem")}
          >
            <ActionButton
              style={{
                color: "var(--infoColor, #0A95C8)",
              }}
              onClick={() => {
                showModal("SimpleInputWithState", {
                  title: t("plugin.method_import_music_item"),
                  withLoading: true,
                  loadingText: t("plugin_management_page.importing_media"),
                  placeholder: t(
                    "plugin_management_page.placeholder_import_music_item",
                    {
                      plugin: row.platform,
                    },
                  ),
                  maxLength: 1000,
                  onOk(text) {
                    return PluginManager.callPluginDelegateMethod(
                      row,
                      "importMusicItem",
                      text.trim(),
                    );
                  },
                  onPromiseResolved(result) {
                    hideModal();
                    showModal("AddMusicToSheet", {
                      musicItems: result as IMusic.IMusicItem[],
                    });
                  },
                  onPromiseRejected() {
                    console.log(t("plugin_management_page.import_failed"));
                  },
                  hints: row.hints?.importMusicItem,
                });
              }}
            >
              {t("plugin.method_import_music_item")}
            </ActionButton>
          </Condition>
          <Condition
            condition={row.supportedMethod.includes("importMusicSheet")}
          >
            <ActionButton
              style={{
                color: "#0A95C8",
              }}
              onClick={() => {
                showModal("SimpleInputWithState", {
                  title: t("plugin.method_import_music_sheet"),
                  withLoading: true,
                  loadingText: t("plugin_management_page.importing_media"),
                  placeholder: t(
                    "plugin_management_page.placeholder_import_music_sheet",
                    {
                      plugin: row.platform,
                    },
                  ),
                  maxLength: 1000,
                  onOk(text) {
                    return PluginManager.callPluginDelegateMethod(
                      row,
                      "importMusicSheet",
                      text.trim(),
                    );
                  },
                  onPromiseResolved(result) {
                    hideModal();
                    showModal("AddMusicToSheet", {
                      musicItems: result as IMusic.IMusicItem[],
                    });
                  },
                  onPromiseRejected() {
                    toast.error(t("plugin_management_page.import_failed"));
                  },
                  hints: row.hints?.importMusicSheet,
                });
              }}
            >
              {t("plugin.method_import_music_sheet")}
            </ActionButton>
          </Condition>
          <Condition condition={row.userVariables?.length}>
            <ActionButton
              style={{
                color: "#0A95C8",
              }}
              onClick={() => {
                showPanel("UserVariables", {
                  variables: row.userVariables,
                  plugin: row,
                  initValues:
                    AppConfig.getConfig("private.pluginMeta")?.[row.platform]
                      ?.userVariables,
                });
              }}
            >
              {t("plugin.prop_user_variable")}
            </ActionButton>
          </Condition>
          <Condition condition={isAccountSyncPlugin(row)}>
            <ActionButton
              style={{
                color: "#FF6B35",
              }}
              onClick={async () => {
                try {
                  const platformKey = getAccountSyncPlatform(row.platform);
                  if (!platformKey) {
                    throw new Error("Unsupported platform: " + row.platform);
                  }
                  const result = await PluginManager.loginPlatform(platformKey);
                  if (result.success) {
                    toast.success(
                      t("plugin.login_success", { plugin: row.platform }),
                    );
                  } else {
                    toast.warn(
                      t("plugin.login_failed") +
                        (result.reason ? ": " + result.reason : ""),
                    );
                  }
                } catch (e) {
                  toast.error(
                    t("plugin.login_failed") + ": " + (e?.message ?? ""),
                  );
                }
              }}
            >
              {t("plugin.login_button")}
            </ActionButton>
          </Condition>
          <Condition condition={isAccountSyncPlugin(row)}>
            <ActionButton
              style={{
                color: "#08A34C",
              }}
              disabled={isSyncing}
              onClick={async () => {
                try {
                  setSyncState({
                    status: "syncing",
                    message: `${row.platform} \u6b63\u5728\u540c\u6b65\u6b4c\u5355...`,
                  });
                  toast.info(
                    t("plugin.sync_started", { plugin: row.platform }),
                  );
                  const syncResult = await syncUserPlaylists(row);
                  if (syncResult.total === 0) {
                    setSyncState({
                      status: "empty",
                      message: `${row.platform} \u672a\u53d1\u73b0\u53ef\u540c\u6b65\u7684\u6b4c\u5355`,
                      imported: syncResult.imported,
                      failed: syncResult.failed,
                      total: syncResult.total,
                      importedItems: syncResult.importedItems,
                      failedItems: syncResult.failedItems,
                    });
                    toast.info(t("plugin.no_playlists"));
                  } else {
                    setSyncState({
                      status: syncResult.failed ? "error" : "success",
                      message: `${row.platform} \u540c\u6b65\u5b8c\u6210\uff1a\u6210\u529f ${syncResult.imported} \u4e2a\uff0c\u5931\u8d25 ${syncResult.failed} \u4e2a`,
                      imported: syncResult.imported,
                      failed: syncResult.failed,
                      total: syncResult.total,
                      importedItems: syncResult.importedItems,
                      failedItems: syncResult.failedItems,
                    });
                    toast.success(
                      t("plugin.sync_success", {
                        count: syncResult.imported,
                        failed: syncResult.failed,
                      }),
                    );
                  }
                } catch (e) {
                  setSyncState({
                    status: "error",
                    message: `${row.platform} \u540c\u6b65\u5931\u8d25\uff1a${e?.message ?? ""}`,
                    imported: 0,
                    failed: 1,
                    total: 0,
                    importedItems: [],
                    failedItems: [e?.message ?? "unknown error"],
                  });
                  toast.error(
                    t("plugin.sync_failed") + ": " + (e?.message ?? ""),
                  );
                }
              }}
            >
              {isSyncing ? "\u540c\u6b65\u4e2d..." : t("plugin.sync_playlists")}
            </ActionButton>
          </Condition>
        </div>
      </div>
      <PlaylistSyncResultPanel state={syncState}></PlaylistSyncResultPanel>
      <div className="plugin-actions-group plugin-actions-group-management">
        <div className="plugin-actions-group-title">{"\u7ba1\u7406"}</div>
        <div className="plugin-actions-group-items">
          <Condition condition={row.srcUrl}>
            <ActionButton
              style={{
                color: "var(--successColor, #08A34C)",
              }}
              onClick={async () => {
                try {
                  await PluginManager.installPluginFromRemote(row.srcUrl);
                  toast.success(
                    t("plugin_management_page.toast_plugin_is_latest", {
                      plugin: row.platform,
                    }),
                  );
                } catch (e) {
                  toast.error(
                    e?.message ?? t("plugin_management_page.update_failed"),
                  );
                }
              }}
            >
              {t("plugin_management_page.update")}
            </ActionButton>
          </Condition>
          <ActionButton
            style={{
              color: "var(--dangerColor, #FC5F5F)",
            }}
            onClick={() => {
              showModal("Reconfirm", {
                title: t("plugin_management_page.uninstall_plugin"),
                content: t(
                  "plugin_management_page.confirm_text_uninstall_plugin",
                  {
                    plugin: row.platform,
                  },
                ),
                async onConfirm() {
                  hideModal();
                  try {
                    await PluginManager.uninstallPlugin(row.hash);
                    toast.success(
                      t("plugin_management_page.uninstall_successfully", {
                        plugin: row.platform,
                      }),
                    );
                  } catch {
                    toast.error(t("plugin_management_page.uninstall_failed"));
                  }
                },
              });
            }}
          >
            {t("plugin_management_page.uninstall")}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function PlaylistSyncResultPanel(props: { state: PlaylistSyncState }) {
  const { state } = props;
  if (state.status === "idle") {
    return null;
  }

  return (
    <div className="plugin-sync-result" data-status={state.status}>
      <div className="plugin-sync-result-title">
        <span>{state.message}</span>
      </div>
      {state.status !== "syncing" ? (
        <>
          <div className="plugin-sync-result-stats">
            <span>
              {"\u603b\u6570"} {state.total}
            </span>
            <span>
              {"\u6210\u529f"} {state.imported}
            </span>
            <span>
              {"\u5931\u8d25"} {state.failed}
            </span>
          </div>
          {state.importedItems.length ? (
            <div className="plugin-sync-result-list">
              {state.importedItems.slice(0, 4).map((item) => (
                <span key={`${item.title}-${item.count}`} title={item.title}>
                  {item.title} · {item.count}
                </span>
              ))}
              {state.importedItems.length > 4 ? (
                <span>
                  {"\u8fd8\u6709"} {state.importedItems.length - 4}{" "}
                  {"\u4e2a\u6b4c\u5355"}
                </span>
              ) : null}
            </div>
          ) : null}
          {state.failedItems.length ? (
            <div className="plugin-sync-result-errors">
              {state.failedItems.slice(0, 3).map((item) => (
                <span key={item} title={item}>
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function PluginTable() {
  const plugins = useSortedPlugins();

  function onDrop(fromIndex: number, toIndex: number) {
    const meta = AppConfig.getConfig("private.pluginMeta") ?? {};

    const newPlugins = plugins
      .slice(0, fromIndex)
      .concat(plugins.slice(fromIndex + 1));
    newPlugins.splice(
      fromIndex < toIndex ? toIndex - 1 : toIndex,
      0,
      plugins[fromIndex],
    );

    const newMeta = produce(meta, (draft) => {
      newPlugins.forEach((plugin, index) => {
        if (!draft[plugin.platform]) {
          draft[plugin.platform] = {};
        }
        draft[plugin.platform].order = index;
      });
    });

    AppConfig.setConfig({
      "private.pluginMeta": newMeta,
    });
  }

  return (
    <div className="plugin-table--container">
      <Condition condition={plugins.length} falsy={<Empty></Empty>}>
        <div className="plugin-table--cards">
          {plugins.map((plugin, index) => (
            <div
              key={PluginManager.getPluginPrimaryKey(plugin).join("-")}
              className="plugin-table--card"
              draggable
              onDragStart={(e) => {
                startDrag(e, index);
              }}
            >
              <IfTruthy condition={index === 0}>
                <DragReceiver
                  position="top"
                  rowIndex={0}
                  onDrop={onDrop}
                ></DragReceiver>
              </IfTruthy>
              <div className="plugin-table--card-header">
                <div className="plugin-table--card-index">#{index + 1}</div>
                <div
                  className="plugin-table--card-title"
                  title={plugin.platform}
                >
                  {plugin.platform}
                </div>
              </div>
              <PluginCapabilityTags plugin={plugin}></PluginCapabilityTags>
              <div className="plugin-table--card-actions">
                <PluginActions row={plugin}></PluginActions>
              </div>
              <DragReceiver
                position="bottom"
                rowIndex={index + 1}
                onDrop={onDrop}
              ></DragReceiver>
            </div>
          ))}
        </div>
      </Condition>
    </div>
  );
}

interface IActionButtonProps {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  disabled?: boolean;
}
function ActionButton(props: IActionButtonProps) {
  const { children, onClick, style, disabled } = props;
  return (
    <span
      className="action-button"
      data-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={style}
    >
      {children}
    </span>
  );
}
