declare module "docxtemplater-image-module-free" {
  interface ImageModuleOptions {
    centered?: boolean;
    fileType?: "docx" | "pptx";
    getImage: (tagValue: unknown, tagName?: string) => Buffer | Uint8Array | ArrayBuffer;
    getSize: (img: unknown, tagValue: unknown, tagName?: string) => [number, number];
  }
  class ImageModule {
    constructor(options: ImageModuleOptions);
    name: string;
    getNextImageName(): string;
  }
  export default ImageModule;
}
