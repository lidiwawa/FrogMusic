declare namespace ICommon {
  export type WithMusicList<T> = T & {
    musicList?: IMusic.IMusicItem[];
  };

  export type PaginationResponse<T> = {
    isEnd?: boolean;
    data?: T[];
  };

  interface IUpdateInfo {
    version: string;
    update?: {
      version: string;
      changeLog: string[];
      download: string[];
    };
  }

  interface IPoint {
    x: number;
    y: number;
  }

  interface ISize {
    width: number;
    height: number;
  }

  interface IDownloadFileSize {
    /** 当前下载的大小 */
    currentSize?: number;
    /** 总大小 */
    totalSize?: number;
  }

  type ICommonReturnType = [
    boolean,
    {
      msg?: string;
      [k: string]: any;
    }?
  ];

  interface ICommand {
    SetPlayerState: PlayerState;
    SkipToPrevious: void;
    SkipToNext: void;
    SetRepeatMode: RepeatMode;
    PlayMusic: IMusic.IMusicItem;
  }

  type ICommandKey = keyof ICommand;
}
