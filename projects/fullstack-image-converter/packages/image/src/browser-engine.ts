import {
  ConversionEngine,
  ConversionJob,
  ConversionOptions,
  InputFormat,
  OutputFormat,
  getMimeType,
  canConvert,
} from '@convertmate/shared';

/**
 * Browser image conversion engine.
 * Uses Canvas API for standard formats, heic2any for HEIC.
 * No server upload — all processing in-browser.
 */
export class BrowserImageEngine implements ConversionEngine {
  canConvert(inputFormat: InputFormat, outputFormat: OutputFormat): boolean {
    const imageFormats = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'gif'] as const;
    const isImageInput = (imageFormats as readonly string[]).includes(inputFormat);
    const isImageOutput = (imageFormats as readonly string[]).includes(outputFormat);
    return isImageInput && isImageOutput && canConvert(inputFormat, outputFormat);
  }

  async convert(job: ConversionJob, options: ConversionOptions = {}): Promise<ConversionJob> {
    const { quality = 92, keepExif: _keepExif = true } = options.image ?? {};
    const source = job.file.source;
    const inputFormat = job.inputFormat;

    let imageBlob: Blob;

    if (inputFormat === 'heic') {
      // Dynamic import to avoid loading heic2any on every page
      const heic2any = (await import('heic2any')).default;
      const inputBlob = source instanceof File
        ? source
        : new Blob([source as ArrayBuffer]);
      const result = await heic2any({
        blob: inputBlob,
        toType: `image/${job.outputFormat === 'png' ? 'png' : 'jpeg'}`,
        quality: quality / 100,
      });
      imageBlob = Array.isArray(result) ? result[0] : result;
    } else {
      // Canvas path for jpg/png/webp/avif
      const bitmap = await createImageBitmap(
        source instanceof File ? source : new Blob([source as ArrayBuffer]),
      );
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();

      const mimeType = getMimeType(job.outputFormat);
      imageBlob = await canvas.convertToBlob({
        type: mimeType,
        quality: quality / 100,
      });
    }

    const resultUrl = URL.createObjectURL(imageBlob);
    return { ...job, resultUrl, status: 'done', progress: 100 };
  }
}
