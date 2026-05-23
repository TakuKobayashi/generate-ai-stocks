#!/usr/bin/env bash
# tools/proto-gen.sh
# Proto から C# / Kotlin / Swift のコードを一括生成する
#
# 依存:
#   - protoc (Protocol Buffers compiler)
#   - protoc-gen-csharp (grpc-dotnet または google/protobuf)
#   - protoc-gen-kotlin (wire または kotlin-protobuf)
#   - swift-protobuf (apple/swift-protobuf)
#
# インストール例:
#   brew install protobuf swift-protobuf
#   pip install grpcio-tools
#   # Kotlin: Wire は Gradle タスクで生成するので ここでは不要

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROTO_DIR="$REPO_ROOT/proto"
GEN_DIR="$REPO_ROOT/gen"

PROTO_FILES=$(find "$PROTO_DIR" -name "*.proto")

echo "=== Cleaning gen/ ==="
rm -rf "$GEN_DIR/csharp" "$GEN_DIR/swift"
mkdir -p "$GEN_DIR/csharp" "$GEN_DIR/swift" "$GEN_DIR/kotlin/com/arpreview/proto"

# ─── C# (Unity 用) ────────────────────────────────────────────
echo "=== Generating C# ==="
protoc \
  --proto_path="$PROTO_DIR" \
  --csharp_out="$GEN_DIR/csharp" \
  $PROTO_FILES

echo "C# generated: $(ls "$GEN_DIR/csharp")"

# ─── Swift (iOS 用) ───────────────────────────────────────────
echo "=== Generating Swift ==="
protoc \
  --proto_path="$PROTO_DIR" \
  --swift_out="$GEN_DIR/swift" \
  $PROTO_FILES

echo "Swift generated: $(ls "$GEN_DIR/swift")"

# ─── Kotlin (Android 用) ─────────────────────────────────────
# Wire を使う場合は Gradle の wire {} ブロックで生成するため
# ここでは protoc-gen-kotlin を使う軽量版のみ示す
if command -v protoc-gen-kotlin &>/dev/null; then
  echo "=== Generating Kotlin ==="
  protoc \
    --proto_path="$PROTO_DIR" \
    --kotlin_out="$GEN_DIR/kotlin" \
    $PROTO_FILES
  echo "Kotlin generated: $(ls "$GEN_DIR/kotlin/com/arpreview/proto")"
else
  echo "=== Kotlin: skipping (protoc-gen-kotlin not found, use Gradle Wire plugin) ==="
fi

# ─── Unity Package へコピー ───────────────────────────────────
UNITY_GEN_DIR="$REPO_ROOT/packages/unity/Runtime/Generated"
mkdir -p "$UNITY_GEN_DIR"
cp "$GEN_DIR/csharp/"*.cs "$UNITY_GEN_DIR/"
echo "=== Copied C# to packages/unity/Runtime/Generated/ ==="

# ─── iOS App へコピー ─────────────────────────────────────────
IOS_GEN_DIR="$REPO_ROOT/apps/ios/ARCompanion/Proto"
mkdir -p "$IOS_GEN_DIR"
cp "$GEN_DIR/swift/"*.swift "$IOS_GEN_DIR/"
echo "=== Copied Swift to apps/ios/ARCompanion/Proto/ ==="

echo ""
echo "✅ Proto generation complete."
echo "   Commit the following directories:"
echo "   - gen/"
echo "   - packages/unity/Runtime/Generated/"
echo "   - apps/ios/ARCompanion/Proto/"
