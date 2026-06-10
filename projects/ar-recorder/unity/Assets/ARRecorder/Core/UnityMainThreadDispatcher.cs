// Assets/ARRecorder/Core/UnityMainThreadDispatcher.cs
using System;
using System.Collections.Generic;
using UnityEngine;

namespace ARRecorder.Core
{
    /// <summary>
    /// バックグラウンドスレッドから Unity メインスレッドでアクションを実行するためのヘルパー。
    /// シーン起動時に自動生成されるシングルトン。
    /// </summary>
    public class UnityMainThreadDispatcher : MonoBehaviour
    {
        private static UnityMainThreadDispatcher _instance;

        public static UnityMainThreadDispatcher Instance()
        {
            if (_instance != null) return _instance;

            var go = new GameObject("[MainThreadDispatcher]");
            _instance = go.AddComponent<UnityMainThreadDispatcher>();
            DontDestroyOnLoad(go);
            return _instance;
        }

        private readonly Queue<Action> _queue = new Queue<Action>();

        public void Enqueue(Action action)
        {
            lock (_queue) { _queue.Enqueue(action); }
        }

        private void Update()
        {
            lock (_queue)
            {
                while (_queue.Count > 0)
                    _queue.Dequeue()?.Invoke();
            }
        }
    }
}
