# =============================================
# Stage 1: ビルド（TypeScript コンパイル + ネイティブモジュール）
# =============================================
FROM node:20-bullseye-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 cmake build-essential libopencv-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

# システム OpenCV を使用してビルド時間を短縮
ENV OPENCV4NODEJS_DISABLE_AUTOBUILD=1

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm install typescript --save-dev && npx tsc

# =============================================
# Stage 2: Tesseract 言語データの事前ダウンロード
# =============================================
FROM node:20-bullseye-slim AS tessdata

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /tessdata && \
    curl -fsSL -o /tessdata/jpn.traineddata \
      https://github.com/tesseract-ocr/tessdata/raw/main/jpn.traineddata && \
    curl -fsSL -o /tessdata/jpn_vert.traineddata \
      https://github.com/tesseract-ocr/tessdata/raw/main/jpn_vert.traineddata && \
    curl -fsSL -o /tessdata/eng.traineddata \
      https://github.com/tesseract-ocr/tessdata/raw/main/eng.traineddata

# =============================================
# Stage 3: 本番ランタイム（最小構成）
# =============================================
FROM node:20-bullseye-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libopencv-core-dev libopencv-imgproc-dev \
    libopencv-imgcodecs-dev libopencv-highgui-dev \
    libjpeg62-turbo libpng16-16 libtiff5 libwebp6 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder  /build/dist         ./dist
COPY --from=builder  /build/node_modules ./node_modules
COPY --from=builder  /build/package.json ./package.json
COPY --from=tessdata /tessdata           ./tessdata

RUN mkdir -p /tmp/doc-scanner && \
    useradd -r -s /bin/false -m -d /home/appuser appuser && \
    chown -R appuser:appuser /app /tmp/doc-scanner

USER appuser

ENV NODE_ENV=production \
    PORT=8080 \
    TESSDATA_DIR=/app/tessdata \
    TEMP_DIR=/tmp/doc-scanner

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/api/server.js"]
