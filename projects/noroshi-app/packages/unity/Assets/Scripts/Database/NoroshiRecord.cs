using System;
using System.Collections.Generic;
using UnityEngine;
using Mono.Data.Sqlite;
using System.Data;
using Noroshi.Models;

namespace Noroshi.Database
{
    /// <summary>
    /// SQLite ActiveRecord パターン実装
    /// </summary>
    public static class NoroshiRecord
    {
        private static string _dbPath;
        private static string ConnectionString => $"URI=file:{_dbPath}";

        public static void Initialize()
        {
            _dbPath = System.IO.Path.Combine(Application.persistentDataPath, "noroshi.db");
            CreateTable();
        }

        private static void CreateTable()
        {
            using var conn = new SqliteConnection(ConnectionString);
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS noroshis (
                    id          TEXT PRIMARY KEY,
                    user_id     TEXT NOT NULL,
                    latitude    REAL NOT NULL,
                    longitude   REAL NOT NULL,
                    geohash     TEXT NOT NULL,
                    address     TEXT NOT NULL,
                    message     TEXT NOT NULL DEFAULT '',
                    start_at    TEXT NOT NULL,
                    end_at      TEXT NOT NULL,
                    created_at  TEXT NOT NULL,
                    synced_at   TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS noroshi_geohash_idx ON noroshis (geohash);
                CREATE INDEX IF NOT EXISTS noroshi_end_at_idx  ON noroshis (end_at);
            ";
            cmd.ExecuteNonQuery();
        }

        // ─── Save / Upsert ───────────────────────────────────────────────

        /// <summary>サーバーから取得した狼煙をローカルDBに保存（upsert）</summary>
        public static void Save(NoroshiModel model)
        {
            using var conn = new SqliteConnection(ConnectionString);
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO noroshis (id, user_id, latitude, longitude, geohash, address, message, start_at, end_at, created_at, synced_at)
                VALUES (@id, @userId, @lat, @lng, @geohash, @address, @message, @startAt, @endAt, @createdAt, datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    latitude  = excluded.latitude,
                    longitude = excluded.longitude,
                    address   = excluded.address,
                    message   = excluded.message,
                    start_at  = excluded.start_at,
                    end_at    = excluded.end_at,
                    synced_at = datetime('now')
            ";
            cmd.Parameters.AddWithValue("@id",        model.id);
            cmd.Parameters.AddWithValue("@userId",    model.userId);
            cmd.Parameters.AddWithValue("@lat",       model.latitude);
            cmd.Parameters.AddWithValue("@lng",       model.longitude);
            cmd.Parameters.AddWithValue("@geohash",   model.geohash);
            cmd.Parameters.AddWithValue("@address",   model.address);
            cmd.Parameters.AddWithValue("@message",   model.message);
            cmd.Parameters.AddWithValue("@startAt",   model.startAt);
            cmd.Parameters.AddWithValue("@endAt",     model.endAt);
            cmd.Parameters.AddWithValue("@createdAt", model.createdAt);
            cmd.ExecuteNonQuery();
        }

        public static void SaveAll(IEnumerable<NoroshiModel> models)
        {
            using var conn = new SqliteConnection(ConnectionString);
            conn.Open();
            using var tx = conn.BeginTransaction();
            foreach (var m in models)
            {
                using var cmd = conn.CreateCommand();
                cmd.Transaction = tx;
                cmd.CommandText = @"
                    INSERT INTO noroshis (id, user_id, latitude, longitude, geohash, address, message, start_at, end_at, created_at, synced_at)
                    VALUES (@id, @userId, @lat, @lng, @geohash, @address, @message, @startAt, @endAt, @createdAt, datetime('now'))
                    ON CONFLICT(id) DO UPDATE SET
                        latitude  = excluded.latitude,
                        longitude = excluded.longitude,
                        address   = excluded.address,
                        message   = excluded.message,
                        start_at  = excluded.start_at,
                        end_at    = excluded.end_at,
                        synced_at = datetime('now')
                ";
                cmd.Parameters.AddWithValue("@id",        m.id);
                cmd.Parameters.AddWithValue("@userId",    m.userId);
                cmd.Parameters.AddWithValue("@lat",       m.latitude);
                cmd.Parameters.AddWithValue("@lng",       m.longitude);
                cmd.Parameters.AddWithValue("@geohash",   m.geohash);
                cmd.Parameters.AddWithValue("@address",   m.address);
                cmd.Parameters.AddWithValue("@message",   m.message);
                cmd.Parameters.AddWithValue("@startAt",   m.startAt);
                cmd.Parameters.AddWithValue("@endAt",     m.endAt);
                cmd.Parameters.AddWithValue("@createdAt", m.createdAt);
                cmd.ExecuteNonQuery();
            }
            tx.Commit();
        }

        // ─── Find ─────────────────────────────────────────────────────────

        /// <summary>現在有効な狼煙を全取得</summary>
        public static List<NoroshiModel> FindActive()
        {
            var results = new List<NoroshiModel>();
            var now = DateTime.UtcNow.ToString("o");

            using var conn = new SqliteConnection(ConnectionString);
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT id, user_id, latitude, longitude, geohash, address, message, start_at, end_at, created_at
                FROM noroshis
                WHERE start_at <= @now AND end_at >= @now
                ORDER BY created_at DESC
            ";
            cmd.Parameters.AddWithValue("@now", now);

            using var reader = cmd.ExecuteReader();
            while (reader.Read())
                results.Add(Map(reader));

            return results;
        }

        public static NoroshiModel FindById(string id)
        {
            using var conn = new SqliteConnection(ConnectionString);
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT * FROM noroshis WHERE id = @id";
            cmd.Parameters.AddWithValue("@id", id);

            using var reader = cmd.ExecuteReader();
            return reader.Read() ? Map(reader) : null;
        }

        // ─── Delete ───────────────────────────────────────────────────────

        /// <summary>期限切れの狼煙を削除</summary>
        public static int DeleteExpired()
        {
            var now = DateTime.UtcNow.ToString("o");
            using var conn = new SqliteConnection(ConnectionString);
            conn.Open();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM noroshis WHERE end_at < @now";
            cmd.Parameters.AddWithValue("@now", now);
            return cmd.ExecuteNonQuery();
        }

        // ─── Mapping ──────────────────────────────────────────────────────

        private static NoroshiModel Map(IDataReader r) => new NoroshiModel
        {
            id        = r["id"].ToString(),
            userId    = r["user_id"].ToString(),
            latitude  = Convert.ToDouble(r["latitude"]),
            longitude = Convert.ToDouble(r["longitude"]),
            geohash   = r["geohash"].ToString(),
            address   = r["address"].ToString(),
            message   = r["message"].ToString(),
            startAt   = r["start_at"].ToString(),
            endAt     = r["end_at"].ToString(),
            createdAt = r["created_at"].ToString(),
        };
    }
}
