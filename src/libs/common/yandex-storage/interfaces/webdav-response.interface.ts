export interface WebDAVFileStat {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: 'file' | 'directory';
  mime?: string;
}

export interface WebDAVDirectoryContents {
  data: WebDAVFileStat[];
}

export type WebDAVResponse = WebDAVFileStat[] | WebDAVDirectoryContents;
