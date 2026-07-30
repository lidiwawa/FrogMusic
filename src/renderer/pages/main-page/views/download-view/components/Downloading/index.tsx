import Tag from "@/renderer/components/Tag";
import Downloader from "@/renderer/core/downloader";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import "./index.scss";
import { i18n } from "@/shared/i18n/renderer";
import useVirtualList from "@/hooks/useVirtualList";
import DownloadStatus from "./DownloadStatus";
import Empty from "@/renderer/components/Empty";
import SvgAsset from "@/renderer/components/SvgAsset";
import { toast } from "react-toastify";
import { DownloadState } from "@/common/constant";

const columnHelper = createColumnHelper<IMusic.IMusicItem>();

const estimizeItemHeight = 2.6 * 13; // lineheight 2.6rem

const { t } = i18n;
const columnDef = [
  columnHelper.accessor((_, index) => index + 1, {
    cell: (info) => info.getValue(),
    header: () => "#",
    id: "index",
    minSize: 40,
    maxSize: 40,
    size: 40,
  }),
  columnHelper.accessor("title", {
    header: () => t("media.media_title"),
    size: 200,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),

  columnHelper.accessor("artist", {
    header: () => t("media.media_type_artist"),
    size: 80,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),
  columnHelper.accessor("album", {
    header: () => t("media.media_type_album"),
    size: 80,
    cell: (info) => <span title={info.getValue()}>{info.getValue()}</span>,
  }),
  columnHelper.display({
    header: () => t("common.status"),
    size: 160,
    id: "status",
    cell: (info) => {
      return <DownloadStatus musicItem={info.row.original}></DownloadStatus>;
    },
  }),
  columnHelper.display({
    header: () => "",
    size: 82,
    id: "action",
    cell: (info) => {
      return <DownloadAction musicItem={info.row.original}></DownloadAction>;
    },
  }),
  columnHelper.accessor("platform", {
    header: () => t("media.media_platform"),
    size: 100,
    cell: (info) => <Tag fill>{info.getValue()}</Tag>,
  }),
];

function DownloadAction(props: { musicItem: IMusic.IMusicItem }) {
  const { musicItem } = props;
  const downloadStatus = Downloader.useDownloadStatus(musicItem);
  const isFailed = downloadStatus?.state === DownloadState.ERROR;

  return (
    <button
      type="button"
      className="download-row-action"
      disabled={!isFailed}
      onClick={(e) => {
        e.stopPropagation();
        Downloader.startDownload(musicItem);
        toast.info("\u5df2\u91cd\u65b0\u52a0\u5165\u4e0b\u8f7d\u961f\u5217");
      }}
    >
      {"\u91cd\u8bd5"}
    </button>
  );
}

export default function Downloading() {
  const downloadingQueue = Downloader.useDownloadingMusicList();
  const summary = Downloader.useDownloadingSummary();

  const table = useReactTable({
    debugAll: false,
    data: downloadingQueue,
    columns: columnDef,
    getCoreRowModel: getCoreRowModel(),
  });

  const virtualController = useVirtualList({
    data: table.getRowModel().rows,
    scrollElementQuery: "#page-container",
    estimateItemHeight: estimizeItemHeight,
  });

  return (
    <div className="downloading-container">
      <div className="download-panel-toolbar">
        <div className="download-panel-summary">
          <span>
            {"\u961f\u5217"} {summary.total}
          </span>
          <span>
            {"\u7b49\u5f85"} {summary.waiting}
          </span>
          <span>
            {"\u4e0b\u8f7d\u4e2d"} {summary.downloading}
          </span>
          <span data-type={summary.error ? "danger" : undefined}>
            {"\u5931\u8d25"} {summary.error}
          </span>
        </div>
        <div className="download-panel-actions">
          <button
            type="button"
            className="download-panel-button"
            disabled={!summary.error}
            onClick={async () => {
              const count = await Downloader.retryFailedDownloads();
              if (count) {
                toast.info(
                  `\u5df2\u91cd\u8bd5\u5931\u8d25\u4efb\u52a1\uff1a${count} \u9996`,
                );
              }
            }}
          >
            <SvgAsset iconName="array-download-tray" size={16}></SvgAsset>
            <span>{"\u91cd\u8bd5\u5931\u8d25"}</span>
          </button>
          <button
            type="button"
            className="download-panel-button"
            disabled={!summary.error}
            onClick={async () => {
              const count = await Downloader.clearFailedDownloads();
              if (count) {
                toast.success(
                  `\u5df2\u6e05\u7406\u5931\u8d25\u4efb\u52a1\uff1a${count} \u9996`,
                );
              }
            }}
          >
            <SvgAsset iconName="trash" size={16}></SvgAsset>
            <span>{"\u6e05\u7406\u5931\u8d25"}</span>
          </button>
        </div>
      </div>
      {!downloadingQueue.length ? (
        <Empty>{"\u5f53\u524d\u6ca1\u6709\u4e0b\u8f7d\u4efb\u52a1"}</Empty>
      ) : (
        <table
          style={{
            tableLayout: "fixed",
            height: virtualController.totalHeight + estimizeItemHeight,
          }}
        >
          <thead>
            <tr>
              {table.getHeaderGroups()[0].headers.map((header) => (
                <th
                  key={header.id}
                  style={{
                    width: header.id === "extra" ? undefined : header.getSize(),
                  }}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            style={{
              transform: `translateY(${virtualController.startTop}px)`,
            }}
          >
            {virtualController.virtualItems.map((virtualItem, index) => {
              const dataItem = virtualItem.dataItem;
              const musicItem = dataItem.original;
              return (
                <tr
                  key={`${musicItem.platform}-${musicItem.id}`}
                  // data-active={
                  //   activeItems.length === 2
                  //     ? isBetween(
                  //         virtualItem.rowIndex,
                  //         activeItems[0],
                  //         activeItems[1]
                  //       )
                  //     : activeItems[0] === virtualItem.rowIndex
                  // }

                  onClick={() => {
                    // 如果点击的时候按下shift
                  }}
                >
                  {dataItem.getAllCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(),
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot
            style={{
              height:
                virtualController.totalHeight -
                virtualController.virtualItems.length * estimizeItemHeight,
            }}
          ></tfoot>
        </table>
      )}
    </div>
  );
}
