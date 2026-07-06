using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace ARTimeCapsule.Models
{
    [Serializable]
    public class ApiResponse<T>
    {
        [JsonProperty("success")] public bool Success { get; set; }
        [JsonProperty("data")]    public T    Data    { get; set; }
        [JsonProperty("error")]   public ApiError Error { get; set; }
    }

    [Serializable]
    public class ApiError
    {
        [JsonProperty("code")]    public string Code    { get; set; }
        [JsonProperty("message")] public string Message { get; set; }
    }

    [Serializable]
    public class TokenPair
    {
        [JsonProperty("accessToken")]      public string AccessToken      { get; set; }
        [JsonProperty("refreshToken")]     public string RefreshToken     { get; set; }
        [JsonProperty("accessExpiresAt")]  public long   AccessExpiresAt  { get; set; }
        [JsonProperty("refreshExpiresAt")] public long   RefreshExpiresAt { get; set; }
    }

    [Serializable]
    public class UserInfo
    {
        [JsonProperty("id")]          public string Id          { get; set; }
        [JsonProperty("email")]       public string Email       { get; set; }
        [JsonProperty("displayName")] public string DisplayName { get; set; }
        [JsonProperty("role")]        public string Role        { get; set; }
        [JsonProperty("shopName")]    public string ShopName    { get; set; }
    }

    [Serializable]
    public class LoginResponse
    {
        [JsonProperty("user")]   public UserInfo  User   { get; set; }
        [JsonProperty("tokens")] public TokenPair Tokens { get; set; }
    }

    [Serializable]
    public class PaginatedResponse<T>
    {
        [JsonProperty("items")]      public List<T> Items      { get; set; }
        [JsonProperty("nextCursor")] public string  NextCursor { get; set; }
        [JsonProperty("total")]      public int     Total      { get; set; }
    }

    [Serializable]
    public class TimeCapsuleListItem
    {
        [JsonProperty("id")]                   public string Id                   { get; set; }
        [JsonProperty("title")]                public string Title                { get; set; }
        [JsonProperty("latitude")]             public double Latitude             { get; set; }
        [JsonProperty("longitude")]            public double Longitude            { get; set; }
        [JsonProperty("arAnchorId")]           public string ArAnchorId           { get; set; }
        [JsonProperty("mediaType")]            public string MediaType            { get; set; }
        [JsonProperty("discoverRadiusMeters")] public int    DiscoverRadiusMeters { get; set; }
        [JsonProperty("distanceMeters")]       public float  DistanceMeters       { get; set; }
        [JsonProperty("createdAt")]            public string CreatedAt            { get; set; }
    }

    [Serializable]
    public class TimeCapsuleDetail
    {
        [JsonProperty("id")]                   public string     Id                   { get; set; }
        [JsonProperty("title")]                public string     Title                { get; set; }
        [JsonProperty("message")]              public string     Message              { get; set; }
        [JsonProperty("latitude")]             public double     Latitude             { get; set; }
        [JsonProperty("longitude")]            public double     Longitude            { get; set; }
        [JsonProperty("arAnchorId")]           public string     ArAnchorId           { get; set; }
        [JsonProperty("mediaType")]            public string     MediaType            { get; set; }
        [JsonProperty("discoverRadiusMeters")] public int        DiscoverRadiusMeters { get; set; }
        [JsonProperty("audio")]                public AudioInfo  Audio                { get; set; }
        [JsonProperty("coupon")]               public CouponInfo Coupon               { get; set; }
    }

    [Serializable]
    public class AudioInfo
    {
        [JsonProperty("id")]              public string Id              { get; set; }
        [JsonProperty("signedUrl")]       public string SignedUrl       { get; set; }
        [JsonProperty("mimeType")]        public string MimeType        { get; set; }
        [JsonProperty("durationSeconds")] public float  DurationSeconds { get; set; }
    }

    [Serializable]
    public class CouponInfo
    {
        [JsonProperty("id")]             public string Id             { get; set; }
        [JsonProperty("title")]          public string Title          { get; set; }
        [JsonProperty("shopName")]       public string ShopName       { get; set; }
        [JsonProperty("redemptionType")] public string RedemptionType { get; set; }
    }

    [Serializable]
    public class LoginRequest
    {
        [JsonProperty("email")]    public string Email    { get; set; }
        [JsonProperty("password")] public string Password { get; set; }
    }

    [Serializable]
    public class RefreshRequest
    {
        [JsonProperty("refreshToken")] public string RefreshToken { get; set; }
    }

    [Serializable]
    public class RedeemCouponRequest
    {
        [JsonProperty("latitude")]  public double Latitude  { get; set; }
        [JsonProperty("longitude")] public double Longitude { get; set; }
    }
}
