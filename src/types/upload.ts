export interface UploadResponse {
  success: boolean;
  message: string;
  url: string;
  metadata: {
    id: string;
    name: string;
    size: number;
    type: string;
    path: string;
    owner: string;
    uploadTime: string;
  };
}
