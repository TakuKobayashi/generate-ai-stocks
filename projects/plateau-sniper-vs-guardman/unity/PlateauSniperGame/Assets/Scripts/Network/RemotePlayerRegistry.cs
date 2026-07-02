// RemotePlayerRegistry.cs - RoomClient DataChannel対応 (Unity 6)
using System.Collections.Generic;
using PlateauSniper.Network;
using UnityEngine;

public class RemotePlayerRegistry : MonoBehaviour
{
    public GameObject remoteSniperPrefab;
    public GameObject remoteBodyguardPrefab;
    public float posLerpSpeed   = 10f;
    public float rotSlerpSpeed  = 10f;
    public float staleThreshSec = 2f;

    class Ghost
    {
        public GameObject Obj;
        public Vector3    TargetPos;
        public Quaternion TargetRot;
        public string     Role;
        public float      LastUpdateTime;
        public Ghost(GameObject obj, string role)
        {
            Obj = obj; Role = role;
            TargetPos = obj.transform.position; TargetRot = obj.transform.rotation;
            LastUpdateTime = Time.time;
        }
    }

    readonly Dictionary<string, Ghost> _ghosts = new();
    string _sniperGhostId = "";

    void Start()
    {
        var rc = RoomClient.Instance;
        if (rc == null) return;

        rc.OnPeerJoined.AddListener(peer => {
            if (peer.ClientId != rc.MyClientId) SpawnGhost(peer.ClientId, peer.Role);
        });
        rc.OnPeerLeft.AddListener((id, _) => RemoveGhost(id));

        rc.OnSniperState.AddListener(msg => {
            var g = FindOrFirstSniper();
            if (g == null) return;
            g.TargetPos = msg.Position; g.TargetRot = msg.Rotation;
            g.LastUpdateTime = Time.time;
            g.Obj.GetComponent<RemoteSniperIndicator>()?.UpdateState(msg.Mode, msg.Tp);
        });

        rc.OnBodyguardState.AddListener(msg => {
            if (msg.Id == rc.MyClientId) return;
            if (!_ghosts.TryGetValue(msg.Id, out var g)) return;
            g.TargetPos = msg.Position; g.TargetRot = msg.Rotation;
            g.LastUpdateTime = Time.time;
            g.Obj.GetComponent<Animator>()?.SetBool("IsSprinting", msg.Sp);
        });
    }

    void Update()
    {
        float now = Time.time;
        foreach (var kv in _ghosts)
        {
            var g = kv.Value;
            bool stale = (now - g.LastUpdateTime) > staleThreshSec;
            g.Obj.SetActive(!stale);
            if (stale) continue;
            g.Obj.transform.position = Vector3.Lerp(g.Obj.transform.position, g.TargetPos, posLerpSpeed * Time.deltaTime);
            g.Obj.transform.rotation = Quaternion.Slerp(g.Obj.transform.rotation, g.TargetRot, rotSlerpSpeed * Time.deltaTime);
        }
    }

    public Transform GetSniperGhostTransform()
    {
        var g = FindOrFirstSniper();
        return g?.Obj.transform;
    }

    Ghost FindOrFirstSniper()
    {
        if (_sniperGhostId != "" && _ghosts.TryGetValue(_sniperGhostId, out var g)) return g;
        foreach (var kv in _ghosts) if (kv.Value.Role == "sniper") { _sniperGhostId = kv.Key; return kv.Value; }
        return null;
    }

    void SpawnGhost(string id, string role)
    {
        if (_ghosts.ContainsKey(id)) return;
        var prefab = role == "sniper" ? remoteSniperPrefab : remoteBodyguardPrefab;
        var obj    = prefab != null ? Instantiate(prefab) : CreateFallback(role);
        obj.name   = $"Ghost_{role}_{id[..4]}";
        _ghosts[id] = new Ghost(obj, role);
        if (role == "sniper") _sniperGhostId = id;
    }

    void RemoveGhost(string id)
    {
        if (!_ghosts.TryGetValue(id, out var g)) return;
        Destroy(g.Obj); _ghosts.Remove(id);
        if (_sniperGhostId == id) _sniperGhostId = "";
    }

    static GameObject CreateFallback(string role)
    {
        var go  = GameObject.CreatePrimitive(role == "sniper" ? PrimitiveType.Capsule : PrimitiveType.Cube);
        var mat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
        mat.color = role == "sniper" ? new Color(1f,0.2f,0.2f,0.7f) : new Color(0.2f,0.4f,1f,0.8f);
        go.GetComponent<Renderer>().material = mat;
        return go;
    }
}

public class RemoteSniperIndicator : MonoBehaviour
{
    public GameObject aimingIndicator;
    public GameObject transitionIndicator;
    public void UpdateState(string mode, float progress)
    {
        if (aimingIndicator)     aimingIndicator.SetActive(mode == "aiming");
        if (transitionIndicator) transitionIndicator.SetActive(mode == "transitioning");
    }
}
