// packages/unity/Tests/Editor/ARPreviewSettingsTests.cs
// Editor Mode テスト — ScriptableObject 設定の検証。

using NUnit.Framework;
using UnityEngine;
using AREditorPreview.Core;

namespace AREditorPreview.Tests.Editor
{
    public class ARPreviewSettingsTests
    {
        [Test]
        public void Default_Settings_Have_Valid_Url()
        {
            var settings = ScriptableObject.CreateInstance<ARPreviewSettings>();
            Assert.IsNotNull(settings);
            // デフォルト値の確認
            Assert.IsTrue(settings.ServerUrl.StartsWith("ws://"),
                "ServerUrl must start with ws://");
            Assert.IsFalse(string.IsNullOrEmpty(settings.RoomName),
                "RoomName must not be empty");
            Object.DestroyImmediate(settings);
        }

        [Test]
        public void JwtHelper_Generates_Three_Part_Token()
        {
            var settings = ScriptableObject.CreateInstance<ARPreviewSettings>();
            var token    = LiveKitTokenHelper.GenerateEditorToken(settings);

            Assert.IsNotNull(token);
            var parts = token.Split('.');
            Assert.AreEqual(3, parts.Length, "JWT must have 3 parts separated by '.'");
            // Base64URL 文字のみ (英数字 + - + _)
            foreach (var part in parts)
                Assert.IsTrue(System.Text.RegularExpressions.Regex.IsMatch(part, @"^[A-Za-z0-9\-_]+$"),
                    $"JWT part must be Base64URL encoded: {part}");

            Object.DestroyImmediate(settings);
        }

        [Test]
        public void JwtHelper_Header_Contains_HS256()
        {
            var settings = ScriptableObject.CreateInstance<ARPreviewSettings>();
            var token    = LiveKitTokenHelper.GenerateEditorToken(settings);
            var header   = token.Split('.')[0];

            // Base64URL デコード
            var pad     = (4 - header.Length % 4) % 4;
            var b64     = header.Replace('-', '+').Replace('_', '/') + new string('=', pad);
            var decoded = System.Text.Encoding.UTF8.GetString(System.Convert.FromBase64String(b64));

            StringAssert.Contains("HS256", decoded);
            StringAssert.Contains("JWT",   decoded);
            Object.DestroyImmediate(settings);
        }
    }

    public class JwtHS256Tests
    {
        [Test]
        public void Encode_Returns_Valid_Three_Part_Token()
        {
            var token = JwtHS256.Encode(@"{""test"":true}", "mysecret");
            var parts = token.Split('.');
            Assert.AreEqual(3, parts.Length);
        }

        [Test]
        public void Different_Secrets_Produce_Different_Signatures()
        {
            const string payload = @"{""room"":""test""}";
            var token1 = JwtHS256.Encode(payload, "secret1");
            var token2 = JwtHS256.Encode(payload, "secret2");

            var sig1 = token1.Split('.')[2];
            var sig2 = token2.Split('.')[2];
            Assert.AreNotEqual(sig1, sig2);
        }
    }
}
