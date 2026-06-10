using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Noroshi.Utils
{
    /// <summary>
    /// Firebase等の非メインスレッドコールバックを Unity メインスレッドで実行するためのユーティリティ
    /// </summary>
    public class UnityMainThreadDispatcher : MonoBehaviour
    {
        private static UnityMainThreadDispatcher _instance;
        private readonly Queue<Action> _queue = new Queue<Action>();

        public static UnityMainThreadDispatcher Instance
        {
            get
            {
                if (_instance == null)
                {
                    var go = new GameObject("UnityMainThreadDispatcher");
                    _instance = go.AddComponent<UnityMainThreadDispatcher>();
                    DontDestroyOnLoad(go);
                }
                return _instance;
            }
        }

        private void Update()
        {
            lock (_queue)
            {
                while (_queue.Count > 0)
                    _queue.Dequeue()?.Invoke();
            }
        }

        public void Enqueue(Action action)
        {
            lock (_queue)
                _queue.Enqueue(action);
        }

        public void Enqueue(IEnumerator coroutine)
        {
            Enqueue(() => StartCoroutine(coroutine));
        }
    }
}
