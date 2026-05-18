/**
 * core/scanner.ts
 * OpenCV を使用したドキュメント輪郭検出 + 透視変換（CLI・API 共通）
 */

export interface ScanResult {
  success: boolean;
  outputPath?: string;
  message?: string;
}

function orderPoints(
  pts: Array<{ x: number; y: number }>
): Array<{ x: number; y: number }> {
  const sumArr  = pts.map((p) => p.x + p.y);
  const diffArr = pts.map((p) => p.x - p.y);
  const tl = pts[sumArr.indexOf(Math.min(...sumArr))];
  const br = pts[sumArr.indexOf(Math.max(...sumArr))];
  const tr = pts[diffArr.indexOf(Math.min(...diffArr))];
  const bl = pts[diffArr.indexOf(Math.max(...diffArr))];
  return [tl, tr, br, bl];
}

export async function scanDocument(
  inputPath: string,
  outputPath: string
): Promise<ScanResult> {
  let cv: typeof import("@u4/opencv4nodejs");
  try {
    cv = await import("@u4/opencv4nodejs");
  } catch {
    return { success: false, message: "opencv4nodejs が利用できません。" };
  }

  try {
    const src = await cv.imreadAsync(inputPath);
    if (src.empty) {
      return { success: false, message: "画像の読み込みに失敗しました。" };
    }

    const origWidth  = src.cols;
    const origHeight = src.rows;
    const PROC_SIZE  = 1000;
    const scale      = PROC_SIZE / Math.max(origWidth, origHeight);
    const resized    = await src.resizeAsync(
      Math.round(origHeight * scale),
      Math.round(origWidth  * scale)
    );

    const gray    = await resized.cvtColorAsync(cv.COLOR_BGR2GRAY);
    const blurred = await gray.gaussianBlurAsync(new cv.Size(5, 5), 0);
    const edges   = await blurred.cannyAsync(75, 200);

    const contours = await edges.findContoursAsync(
      cv.RETR_LIST,
      cv.CHAIN_APPROX_SIMPLE
    );

    const sorted = contours
      .slice()
      .sort((a, b) => b.area - a.area)
      .slice(0, 10);

    let docPoints: Array<{ x: number; y: number }> | null = null;
    for (const contour of sorted) {
      const peri  = contour.arcLength(true);
      const approx = contour.approxPolyDP(0.02 * peri, true);
      if (
        approx.length === 4 &&
        contour.area > (Math.round(origWidth * scale) * Math.round(origHeight * scale)) * 0.1
      ) {
        docPoints = approx.map((p) => ({ x: p.x, y: p.y }));
        break;
      }
    }

    if (!docPoints) {
      return { success: false, message: "ドキュメントの輪郭が検出できませんでした。" };
    }

    const inv = 1 / scale;
    const [tl, tr, br, bl] = orderPoints(
      docPoints.map((p) => ({ x: p.x * inv, y: p.y * inv }))
    );

    const maxWidth  = Math.round(Math.max(
      Math.hypot(tr.x - tl.x, tr.y - tl.y),
      Math.hypot(br.x - bl.x, br.y - bl.y)
    ));
    const maxHeight = Math.round(Math.max(
      Math.hypot(bl.x - tl.x, bl.y - tl.y),
      Math.hypot(br.x - tr.x, br.y - tr.y)
    ));

    const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y,
    ]);
    const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0, maxWidth - 1, 0, maxWidth - 1, maxHeight - 1, 0, maxHeight - 1,
    ]);

    const M      = await cv.getPerspectiveTransformAsync(srcMat, dstMat);
    const warped = await src.warpPerspectiveAsync(M, new cv.Size(maxWidth, maxHeight));
    await cv.imwriteAsync(outputPath, warped);

    return { success: true, outputPath };
  } catch (err) {
    return { success: false, message: `スキャン処理エラー: ${(err as Error).message}` };
  }
}
