#include <jni.h>
#include <string>
#include <vector>
#include <android/log.h>

#include "whisper.cpp/include/whisper.h"

#define TAG "WhisperJNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

// ===================================================================
// ヘルパー
// ===================================================================
static const char* JNI_CLASS = "com/example/whispertranscriber/whisper/WhisperEngine";

static std::string jstring2str(JNIEnv* env, jstring jstr) {
    if (!jstr) return "";
    const char* chars = env->GetStringUTFChars(jstr, nullptr);
    std::string result(chars);
    env->ReleaseStringUTFChars(jstr, chars);
    return result;
}

// ===================================================================
// JNI エクスポート
// ===================================================================
extern "C" {

/**
 * モデルを読み込み、コンテキストポインタを返す
 * @param modelPath  ggml モデルファイルのパス
 * @return           コンテキストポインタ（失敗時は 0）
 */
JNIEXPORT jlong JNICALL
Java_com_example_whispertranscriber_whisper_WhisperEngine_nativeInitContext(
        JNIEnv* env, jobject /* this */, jstring modelPath) {

    const std::string path = jstring2str(env, modelPath);
    LOGI("モデル読み込み: %s", path.c_str());

    whisper_context_params params = whisper_context_default_params();
    params.use_gpu = false;  // CPU 推論（安定性優先）

    whisper_context* ctx = whisper_init_from_file_with_params(path.c_str(), params);
    if (!ctx) {
        LOGE("モデル読み込み失敗: %s", path.c_str());
        return 0L;
    }

    LOGI("モデル読み込み完了");
    return reinterpret_cast<jlong>(ctx);
}

/**
 * コンテキストを解放する
 */
JNIEXPORT void JNICALL
Java_com_example_whispertranscriber_whisper_WhisperEngine_nativeFreeContext(
        JNIEnv* /* env */, jobject /* this */, jlong contextPtr) {

    if (contextPtr == 0) return;
    auto* ctx = reinterpret_cast<whisper_context*>(contextPtr);
    whisper_free(ctx);
    LOGI("コンテキスト解放完了");
}

/**
 * 音声データを文字起こしする
 * @param contextPtr  初期化済みコンテキストポインタ
 * @param audioData   16kHz・モノラル・float32 PCM サンプル
 * @param language    言語コード ("ja", "en", "auto")
 * @param nThreads    推論スレッド数
 * @return            文字起こし結果テキスト（失敗時は空文字列）
 */
JNIEXPORT jstring JNICALL
Java_com_example_whispertranscriber_whisper_WhisperEngine_nativeTranscribe(
        JNIEnv* env, jobject /* this */,
        jlong contextPtr,
        jfloatArray audioData,
        jstring language,
        jint nThreads) {

    if (contextPtr == 0) {
        LOGE("コンテキストが初期化されていません");
        return env->NewStringUTF("");
    }

    auto* ctx = reinterpret_cast<whisper_context*>(contextPtr);

    // float[] を取得
    jsize numSamples = env->GetArrayLength(audioData);
    jfloat* samples = env->GetFloatArrayElements(audioData, nullptr);
    if (!samples) {
        LOGE("サンプルデータの取得失敗");
        return env->NewStringUTF("");
    }

    // whisper パラメータ設定
    whisper_full_params params = whisper_full_default_params(WHISPER_SAMPLING_GREEDY);

    const std::string lang = jstring2str(env, language);
    params.language      = lang.empty() ? "ja" : lang.c_str();
    params.translate     = false;
    params.n_threads     = static_cast<int>(nThreads);
    params.print_special = false;
    params.print_progress = false;
    params.print_realtime = false;
    params.print_timestamps = false;
    params.single_segment = false;
    params.no_context    = true;   // セッション間の文脈を引き継がない

    // 推論実行
    int result = whisper_full(ctx, params, samples, static_cast<int>(numSamples));
    env->ReleaseFloatArrayElements(audioData, samples, JNI_ABORT);

    if (result != 0) {
        LOGE("whisper_full 失敗: %d", result);
        return env->NewStringUTF("");
    }

    // セグメントからテキストを結合
    const int nSegments = whisper_full_n_segments(ctx);
    std::string text;
    for (int i = 0; i < nSegments; ++i) {
        const char* seg = whisper_full_get_segment_text(ctx, i);
        if (seg) text += seg;
    }

    LOGI("文字起こし完了: %d セグメント, %zu 文字", nSegments, text.size());
    return env->NewStringUTF(text.c_str());
}

/**
 * whisper.cpp のシステム情報を返す（デバッグ用）
 */
JNIEXPORT jstring JNICALL
Java_com_example_whispertranscriber_whisper_WhisperEngine_nativeSystemInfo(
        JNIEnv* env, jobject /* this */) {
    return env->NewStringUTF(whisper_print_system_info());
}

} // extern "C"
