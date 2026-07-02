// BodyguardController.cs - Unity 6 / RoomClient + WebRTC DataChannel 対応
using PlateauSniper.Network;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Events;

[RequireComponent(typeof(CharacterController))]
[RequireComponent(typeof(BodyguardInputActions))]
public class BodyguardController : MonoBehaviour
{
    [Header("移動")]
    public float walkSpeed   = 4f;
    public float sprintSpeed = 7f;
    public float gravity     = -9.81f;
    [Header("視点")]
    public float mouseSensitivity = 2f;
    public float verticalClampMin = -80f;
    public float verticalClampMax = 80f;
    public Transform cameraHolder;
    [Header("スナイパー発見")]
    public float     detectScreenRadius = 0.15f;
    public LayerMask occlusionMask;
    [Header("命令")]
    public Transform   vipTransform;
    public Transform[] coverPoints;
    public NpcGuard[]  availableGuards;

    public UnityEvent OnIssueCoverOrder    = new();
    public UnityEvent OnIssueDispatchOrder = new();

    CharacterController   _cc;
    BodyguardInputActions _input;
    Camera                _cam;
    Vector3               _velocity;
    float                 _verticalAngle;

    void Awake()
    {
        _cc    = GetComponent<CharacterController>();
        _input = GetComponent<BodyguardInputActions>();
        _cam   = cameraHolder != null ? cameraHolder.GetComponentInChildren<Camera>() : Camera.main;
    }
    void Start() { Cursor.lockState = CursorLockMode.Locked; Cursor.visible = false; }

    void Update()
    {
        if (!GameManager.Instance.IsPlaying) return;
        HandleLook(); HandleMovement(); HandleOrders(); CheckSniperDetection();
        RoomClient.Instance?.SendBodyguardState(
            transform.position, transform.rotation, _input.SprintAction.IsPressed());
    }

    void HandleLook()
    {
        var look = _input.LookAction.ReadValue<Vector2>();
        _verticalAngle -= look.y * mouseSensitivity * Time.deltaTime * 100f;
        _verticalAngle  = Mathf.Clamp(_verticalAngle, verticalClampMin, verticalClampMax);
        transform.Rotate(Vector3.up * look.x * mouseSensitivity * Time.deltaTime * 100f);
        if (cameraHolder) cameraHolder.localEulerAngles = new Vector3(_verticalAngle, 0f, 0f);
    }

    void HandleMovement()
    {
        float speed = _input.SprintAction.IsPressed() ? sprintSpeed : walkSpeed;
        var   move  = _input.MoveAction.ReadValue<Vector2>();
        Vector3 dir = transform.right * move.x + transform.forward * move.y; dir.y = 0f;
        if (_cc.isGrounded && _velocity.y < 0f) _velocity.y = -2f;
        _velocity.y += gravity * Time.deltaTime;
        _cc.Move((dir * speed + _velocity) * Time.deltaTime);
    }

    void HandleOrders()
    {
        if (_input.CoverOrder.WasPressedThisFrame())    IssueCoverOrder();
        if (_input.DispatchOrder.WasPressedThisFrame()) IssueDispatchOrder();
    }

    void IssueCoverOrder()
    {
        if (vipTransform == null || coverPoints == null || coverPoints.Length == 0) return;
        Transform best = null; float bestDist = float.MaxValue;
        foreach (var cp in coverPoints) {
            float d = Vector3.Distance(vipTransform.position, cp.position);
            if (d < bestDist) { bestDist = d; best = cp; }
        }
        if (best == null) return;
        vipTransform.GetComponent<NavMeshAgent>()?.SetDestination(best.position);
        OnIssueCoverOrder.Invoke();
        RoomClient.Instance?.SendCoverOrder(best.name);
    }

    void IssueDispatchOrder()
    {
        if (availableGuards == null || availableGuards.Length == 0) return;
        NpcGuard nearest = null; float nearestDist = float.MaxValue;
        foreach (var g in availableGuards) {
            if (g == null || g.IsDispatched) continue;
            float d = Vector3.Distance(transform.position, g.transform.position);
            if (d < nearestDist) { nearestDist = d; nearest = g; }
        }
        if (nearest == null) return;
        var sniperT = DetectionManager.Instance?.sniperTransform
                   ?? FindAnyObjectByType<RemotePlayerRegistry>()?.GetSniperGhostTransform();
        if (sniperT != null) nearest.DispatchToCapture(sniperT);
        OnIssueDispatchOrder.Invoke();
        RoomClient.Instance?.SendDispatchOrder(nearest.name);
    }

    void CheckSniperDetection()
    {
        var dm = DetectionManager.Instance;
        if (dm == null || _cam == null) return;
        Transform sniper = dm.sniperTransform
            ?? FindAnyObjectByType<RemotePlayerRegistry>()?.GetSniperGhostTransform();
        if (sniper == null) return;
        Vector3 screenPos = _cam.WorldToViewportPoint(sniper.position);
        if (screenPos.z <= 0f) return;
        if (Vector2.Distance(new Vector2(screenPos.x, screenPos.y), Vector2.one * 0.5f)
            > detectScreenRadius) return;
        Vector3 toSniper = sniper.position - _cam.transform.position;
        if (Physics.Raycast(_cam.transform.position, toSniper.normalized,
            out RaycastHit _, toSniper.magnitude, occlusionMask)) return;
        dm.RegisterDetecting();
    }
}
