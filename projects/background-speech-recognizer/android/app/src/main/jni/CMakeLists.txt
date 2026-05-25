cmake_minimum_required(VERSION 3.22.1)
project(whispertranscriber)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ===================================================================
# whisper.cpp ソースの場所
# app/src/main/jni/whisper.cpp/ にクローンすること
# git clone https://github.com/ggerganov/whisper.cpp.git
# ===================================================================
set(WHISPER_CPP_DIR "${CMAKE_CURRENT_SOURCE_DIR}/whisper.cpp")

if(NOT EXISTS "${WHISPER_CPP_DIR}/whisper.h")
    message(FATAL_ERROR
        "whisper.cpp が見つかりません。\n"
        "以下のコマンドを実行してください:\n"
        "  cd app/src/main/jni\n"
        "  git clone https://github.com/ggerganov/whisper.cpp.git\n"
    )
endif()

# ggml ライブラリ
add_library(ggml STATIC
    ${WHISPER_CPP_DIR}/ggml/src/ggml.c
    ${WHISPER_CPP_DIR}/ggml/src/ggml-alloc.c
    ${WHISPER_CPP_DIR}/ggml/src/ggml-backend.cpp
    ${WHISPER_CPP_DIR}/ggml/src/ggml-quants.c
    ${WHISPER_CPP_DIR}/ggml/src/ggml-threading.cpp
)

target_include_directories(ggml PUBLIC
    ${WHISPER_CPP_DIR}/ggml/include
    ${WHISPER_CPP_DIR}/ggml/src
)

target_compile_options(ggml PRIVATE -O3 -ffast-math)

# whisper ライブラリ
add_library(whisper STATIC
    ${WHISPER_CPP_DIR}/src/whisper.cpp
)

target_include_directories(whisper PUBLIC
    ${WHISPER_CPP_DIR}/include
    ${WHISPER_CPP_DIR}/ggml/include
)

target_link_libraries(whisper PUBLIC ggml)
target_compile_options(whisper PRIVATE -O3)

# JNI ブリッジ
add_library(whisper-jni SHARED
    whisper_jni.cpp
)

target_include_directories(whisper-jni PRIVATE
    ${WHISPER_CPP_DIR}/include
    ${WHISPER_CPP_DIR}/ggml/include
)

target_link_libraries(whisper-jni
    whisper
    ggml
    android
    log
)

target_compile_options(whisper-jni PRIVATE -O3)
