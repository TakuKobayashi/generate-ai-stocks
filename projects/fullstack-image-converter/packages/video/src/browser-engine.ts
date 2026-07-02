import { ConversionEngine, ConversionJob, ConversionOptions, InputFormat, OutputFormat, canConvert } from '@convertmate/shared';

/**
 * Browser video conversion engine using @ffmpeg/ffmpeg (WASM).
 * Loaded lazily — only when a video conversion is triggered.
 */
export class BrowserVideoEngine implements ConversionEngine {
  private ffmpeg: any = null;

  canConvert(inputFormat: InputFormat, outputFormat: OutputFormat): boolean {
    const videoFormats = ['mp4', 'mov', 'gif'] as const;
    return (videoFormats as readonly string[]).includes(inputFormat) &&
           (videoFormats as readonly string[]).includes(outputFormat) &&
           canConvert(inputFormat, outputFormat);
  }

  private async load(onProgress?: (p: number) => void) {
    if (this.ffmpeg) return;
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
    this._fetchFile = fetchFile;

    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    if (onProgress) {
      ffmpeg.on('progress', ({ progress }: { progress: number }) => onProgress(progress * 100));
    }
    this.ffmpeg = ffmpeg;
  }

  private _fetchFile: any = null;

  async convert(job: ConversionJob, _options: ConversionOptions = {}): Promise<ConversionJob> {
    await this.load((p) => { job.progress = p; });

    const inputName = `input.${job.inputFormat}`;
    const outputName = `output.${job.outputFormat}`;

    const source = job.file.source;
    const data = source instanceof File
      ? await this._fetchFile(source)
      : new Uint8Array(source as ArrayBuffer);

    await this.ffmpeg.writeFile(inputName, data);

    const args = this.buildArgs(job.inputFormat, job.outputFormat, inputName, outputName);
    await this.ffmpeg.exec(args);

    const result: Uint8Array = await this.ffmpeg.readFile(outputName);
    const mime = job.outputFormat === 'gif' ? 'image/gif'
                 : job.outputFormat === 'mov' ? 'video/quicktime'
                 : 'video/mp4';
    const blob = new Blob([result.buffer], { type: mime });
    const resultUrl = URL.createObjectURL(blob);

    // cleanup
    await this.ffmpeg.deleteFile(inputName);
    await this.ffmpeg.deleteFile(outputName);

    return { ...job, resultUrl, status: 'done', progress: 100 };
  }

  private buildArgs(input: string, output: string, inputName: string, outputName: string): string[] {
    if (output === 'gif') {
      return [
        '-i', inputName,
        '-vf', 'fps=10,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
        '-loop', '0',
        outputName,
      ];
    }
    if (output === 'mp4') {
      return ['-i', inputName, '-c:v', 'libx264', '-crf', '23', '-preset', 'fast', '-c:a', 'aac', outputName];
    }
    if (output === 'mov') {
      return ['-i', inputName, '-c:v', 'libx264', '-c:a', 'aac', '-movflags', '+faststart', outputName];
    }
    return ['-i', inputName, outputName];
  }
}
