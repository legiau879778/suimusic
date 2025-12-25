// src/types/qrcode.d.ts
declare module "qrcode" {
  export type QRCodeRenderersOptions = {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    color?: {
      dark?: string;
      light?: string;
    };
  };

  const QRCode: {
    toCanvas: (
      canvas: HTMLCanvasElement,
      text: string,
      options?: QRCodeRenderersOptions
    ) => Promise<void>;

    toDataURL: (text: string, options?: QRCodeRenderersOptions) => Promise<string>;

    toString: (text: string, options?: any) => Promise<string>;
  };

  export default QRCode;
}
