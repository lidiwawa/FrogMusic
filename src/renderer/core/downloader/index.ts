import {
  getMediaPrimaryKey,
  getQualityOrder,
  isSameMedia,
  setInternalData,
} from "@/common/media-util";
import * as Comlink from "comlink";
import { DownloadState, localPluginName } from "@/common/constant";
import PQueue from "p-queue";
import {
  addDownloadedMusicToList,
  isDownloaded,
  removeDownloadedMusic,
  setupDownloadedMusicList,
  useDownloaded,
  useDownloadedMusicList,
} from "./downloaded-sheet";
import { getGlobalContext } from "@/shared/global-context/renderer";
import Store from "@/common/store";
import { useEffect, useState } from "react";
import { DownloadEvts, ee } from "./ee";
import AppConfig from "@shared/app-config/renderer";
import PluginManager from "@shared/plugin-manager/renderer";

export interface IDownloadStatus {
  state: DownloadState;
  downloaded?: number;
  total?: number;
  msg?: string;
}

export interface IDownloadingSummary {
  total: number;
  waiting: number;
  downloading: number;
  error: number;
}

const downloadingMusicStore = new Store<Array<IMusic.IMusicItem>>([]);
const downloadingProgress = new Map<string, IDownloadStatus>();
const downloadingSummaryStore = new Store<IDownloadingSummary>({
  total: 0,
  waiting: 0,
  downloading: 0,
  error: 0,
});

type ProxyMarkedFunction<T extends (...args: any) => void> = T &
  Comlink.ProxyMarked;

type IOnStateChangeFunc = (data: IDownloadStatus) => void;

interface IDownloaderWorker {
  downloadFile: (
    mediaSource: IMusic.IMusicSource,
    filePath: string,
    onStateChange: ProxyMarkedFunction<IOnStateChangeFunc>,
  ) => Promise<void>;
}

let downloaderWorker: IDownloaderWorker;

async function setupDownloader() {
  setupDownloaderWorker();
  setupDownloadedMusicList();
}

function setupDownloaderWorker() {
  // 初始化worker
  const downloaderWorkerPath = getGlobalContext().workersPath.downloader;
  if (downloaderWorkerPath) {
    const worker = new Worker(downloaderWorkerPath);
    downloaderWorker = Comlink.wrap(worker);
  }
  setDownloadingConcurrency(AppConfig.getConfig("download.concurrency"));
}

const concurrencyLimit = 20;
const downloadingQueue = new PQueue({
  concurrency: 5,
});

function setDownloadingConcurrency(concurrency: number) {
  if (isNaN(concurrency)) {
    return;
  }
  downloadingQueue.concurrency = Math.min(
    concurrency < 1 ? 1 : concurrency,
    concurrencyLimit,
  );
}

function updateDownloadingSummary() {
  const progressList = Array.from(downloadingProgress.values());
  downloadingSummaryStore.setValue({
    total: downloadingMusicStore.getValue().length,
    waiting: progressList.filter((it) => it.state === DownloadState.WAITING)
      .length,
    downloading: progressList.filter(
      (it) => it.state === DownloadState.DOWNLOADING,
    ).length,
    error: progressList.filter((it) => it.state === DownloadState.ERROR).length,
  });
}

async function startDownload(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
) {
  if (!downloaderWorker) {
    setupDownloaderWorker();
  }

  const _musicItems = Array.isArray(musicItems) ? musicItems : [musicItems];
  const _validMusicItems = _musicItems.filter((it) => {
    if (isDownloaded(it) || it.platform === localPluginName) {
      return false;
    }
    const status = downloadingProgress.get(getMediaPrimaryKey(it));
    return !status || status.state === DownloadState.ERROR;
  });

  const downloadCallbacks = _validMusicItems.map((it) => {
    const pk = getMediaPrimaryKey(it);
    downloadingProgress.set(pk, {
      state: DownloadState.WAITING,
    });
    updateDownloadingSummary();

    return async () => {
      // Not on waiting list
      if (!downloadingProgress.has(pk)) {
        return;
      }

      downloadingProgress.get(pk).state = DownloadState.DOWNLOADING;
      updateDownloadingSummary();
      const fileName = `${it.title}-${it.artist}`.replace(/[/|\\?*"<>:]/g, "_");
      await new Promise<void>((resolve) => {
        downloadMusicImpl(it, fileName, (stateData) => {
          downloadingProgress.set(pk, stateData);
          ee.emit(DownloadEvts.DownloadStatusUpdated, it, stateData);
          if (stateData.state === DownloadState.DONE) {
            downloadingMusicStore.setValue((prev) =>
              prev.filter((di) => !isSameMedia(it, di)),
            );
            downloadingProgress.delete(pk);
            resolve();
          } else if (stateData.state === DownloadState.ERROR) {
            resolve();
          }
          updateDownloadingSummary();
        });
      });
    };
  });

  downloadingMusicStore.setValue((prev) => {
    const existedPKs = new Set(prev.map((it) => getMediaPrimaryKey(it)));
    return [
      ...prev,
      ..._validMusicItems.filter(
        (it) => !existedPKs.has(getMediaPrimaryKey(it)),
      ),
    ];
  });
  downloadingQueue.addAll(downloadCallbacks);
  updateDownloadingSummary();
}

async function downloadMusicImpl(
  musicItem: IMusic.IMusicItem,
  fileName: string,
  onStateChange: IOnStateChangeFunc,
) {
  const [defaultQuality, whenQualityMissing] = [
    AppConfig.getConfig("download.defaultQuality"),
    AppConfig.getConfig("download.whenQualityMissing"),
  ];
  const qualityOrder = getQualityOrder(defaultQuality, whenQualityMissing);
  let mediaSource: IPlugin.IMediaSourceResult | null = null;
  let realQuality: IMusic.IQualityKey = qualityOrder[0];
  for (const quality of qualityOrder) {
    try {
      mediaSource = await PluginManager.callPluginDelegateMethod(
        musicItem,
        "getMediaSource",
        musicItem,
        quality,
      );
      if (!mediaSource?.url) {
        continue;
      }
      realQuality = quality;
      break;
    } catch {}
  }

  try {
    if (mediaSource?.url) {
      const ext = mediaSource.url.match(/.*\/.+\.([^./?#]+)/)?.[1] ?? "mp3";
      const downloadBasePath =
        AppConfig.getConfig("download.path") ??
        getGlobalContext().appPath.downloads;
      const downloadPath = window.path.resolve(
        downloadBasePath,
        `./${fileName}.${ext}`,
      );
      downloaderWorker.downloadFile(
        mediaSource,
        downloadPath,
        Comlink.proxy((dataState) => {
          onStateChange(dataState);
          if (dataState.state === DownloadState.DONE) {
            addDownloadedMusicToList(
              setInternalData<IMusic.IMusicItemInternalData>(
                musicItem as any,
                "downloadData",
                {
                  path: downloadPath,
                  quality: realQuality,
                },
                true,
              ) as IMusic.IMusicItem,
            );
          }
        }),
      );
    } else {
      throw new Error("Invalid Source");
    }
  } catch (e) {
    console.log(e, "ERROR");
    onStateChange({
      state: DownloadState.ERROR,
      msg: e?.message,
    });
  }
}

function useDownloadStatus(musicItem: IMusic.IMusicItem) {
  const [downloadStatus, setDownloadStatus] = useState<IDownloadStatus | null>(
    null,
  );

  useEffect(() => {
    setDownloadStatus(
      downloadingProgress.get(getMediaPrimaryKey(musicItem)) || null,
    );

    const updateFn = (mi: IMusic.IMusicItem, stateData: IDownloadStatus) => {
      if (isSameMedia(mi, musicItem)) {
        setDownloadStatus(stateData);
      }
    };

    ee.on(DownloadEvts.DownloadStatusUpdated, updateFn);

    return () => {
      ee.off(DownloadEvts.DownloadStatusUpdated, updateFn);
    };
  }, [musicItem]);

  return downloadStatus;
}

// 下载状态
function useDownloadState(musicItem: IMusic.IMusicItem) {
  const musicStatus = useDownloadStatus(musicItem);
  const downloaded = useDownloaded(musicItem);

  return (
    musicStatus?.state || (downloaded ? DownloadState.DONE : DownloadState.NONE)
  );
}

function useDownloadingSummary() {
  return downloadingSummaryStore.useValue();
}

async function clearFailedDownloads() {
  const failedPKs = new Set(
    Array.from(downloadingProgress.entries())
      .filter(([, status]) => status.state === DownloadState.ERROR)
      .map(([pk]) => pk),
  );

  if (!failedPKs.size) {
    return 0;
  }

  downloadingMusicStore.setValue((prev) =>
    prev.filter((it) => !failedPKs.has(getMediaPrimaryKey(it))),
  );
  failedPKs.forEach((pk) => {
    downloadingProgress.delete(pk);
  });
  updateDownloadingSummary();
  return failedPKs.size;
}

async function retryFailedDownloads() {
  const failedPKs = new Set(
    Array.from(downloadingProgress.entries())
      .filter(([, status]) => status.state === DownloadState.ERROR)
      .map(([pk]) => pk),
  );
  const failedItems = downloadingMusicStore
    .getValue()
    .filter((it) => failedPKs.has(getMediaPrimaryKey(it)));

  if (!failedItems.length) {
    return 0;
  }

  await startDownload(failedItems);
  return failedItems.length;
}

const Downloader = {
  setupDownloader,
  startDownload,
  useDownloadStatus,
  useDownloadingMusicList: downloadingMusicStore.useValue,
  useDownloaded,
  isDownloaded,
  useDownloadedMusicList,
  removeDownloadedMusic,
  setDownloadingConcurrency,
  useDownloadState,
  useDownloadingSummary,
  clearFailedDownloads,
  retryFailedDownloads,
};
export default Downloader;
