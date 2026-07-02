// SniperController.cs - Unity 6 / RoomClient + WebRTC DataChannel 対応
using System.Collections;
using PlateauSniper.Network;
using UnityEngine;
using UnityEngine.Events;

[RequireComponent(typeof(CharacterController))]
[RequireComponent(typeof(SniperInputActions))]
public class SniperController : MonoBehaviour
{
    [Header("移動")]
    public float walkSpeed   = 3f;
    public float sprintSpeed = 5f;
    public float gravity     = -9.81f;

    [Header("視点")]
    public float mouseSensitivity = 2f;
    public float verticalClampMin = -80f;
    public float verticalClampMax = 80f;
    public Transform cameraHolder;

    [Header("狙撃")]
    public float     modeTransitionDuration = 10f;
    public LayerMask shootLayerMask;
    public float     maxShootRange = 500f;

    [Header("スコープ")]
    public float scopeFOV  = 15f;
    public float normalFOV = 70f;

    public UnityEvent             OnEnteredAimMode     = new();
    public UnityEvent             OnExitedAimMode      = new();
    public UnityEvent             OnTransitionStart    = new();
    public UnityEvent<float>      OnTransitionProgress = new();

    public enum SniperMode { Walking, Transitioning, Aiming }
    public SniperMode CurrentMode { get; private set; } = SniperMode.Walking;

    CharacterController _cc;
    SniperInputActions  _input;
    Camera              _cam;
    float               _verticalAngle;
    Vector3             _velocity;
    bool                _transitionToAim;
    float               _transitionTimer;

    void Awake()
    {
        _cc    = GetComponent<CharacterController>();
        _input = GetComponent<SniperInputActions>();
        _cam   = cameraHolder != null
                 ? cameraHolder.GetComponentInChildren<Camera>() : Camera.main;
    }

    void Start()
    {
        DetectionManager.Instance?.RegisterSniper(transform);
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible   = false;
        if (_cam) _cam.fieldOfView = normalFOV;
    }

    void Update()
    {
        if (!GameManager.Instance.IsPlaying) return;
        HandleLook();
        HandleMovement();
        HandleTransitionInput();
        HandleTransition();
        HandleFire();

        // ─── WebRTC DataChannel で位置を送信 (20fps制御はRoomClient側) ──
        string modeStr = CurrentMode switch {
            SniperMode.Aiming        => "aiming",
            SniperMode.Transitioning => "transitioning",
            _                        => "walking",
        };
        float progress = CurrentMode == SniperMode.Transitioning
            ? Mathf.Clamp01(_transitionTimer / modeTransitionDuration) : 0f;

        RoomClient.Instance?.SendSniperState(
            transform.position, transform.rotation, modeStr, progress);
    }

    void HandleLook()
    {
        var look   = _input.LookAction.ReadValue<Vector2>();
        float yaw  = look.x * mouseSensitivity * Time.deltaTime * 100f;
        float pitch= look.y * mouseSensitivity * Time.deltaTime * 100f;
        _verticalAngle -= pitch;
        _verticalAngle  = Mathf.Clamp(_verticalAngle, verticalClampMin, verticalClampMax);
        transform.Rotate(Vector3.up * yaw);
        if (cameraHolder) cameraHolder.localEulerAngles = new Vector3(_verticalAngle, 0f, 0f);
    }

    void HandleMovement()
    {
        if (CurrentMode == SniperMode.Aiming) return;
        float speedMult = CurrentMode == SniperMode.Transitioning ? 0.5f : 1f;
        bool  sprinting = _input.SprintAction.IsPressed();
        float speed     = (sprinting ? sprintSpeed : walkSpeed) * speedMult;
        var   move      = _input.MoveAction.ReadValue<Vector2>();
        Vector3 dir     = transform.right * move.x + transform.forward * move.y;
        dir.y = 0f;
        if (_cc.isGrounded && _velocity.y < 0f) _velocity.y = -2f;
        _velocity.y += gravity * Time.deltaTime;
        _cc.Move((dir * speed + _velocity) * Time.deltaTime);
    }

    void HandleTransitionInput()
    {
        if (CurrentMode == SniperMode.Transitioning) return;
        if (_input.AimToggle.WasPressedThisFrame())
        {
            if (CurrentMode == SniperMode.Walking) BeginTransition(true);
            else if (CurrentMode == SniperMode.Aiming) BeginTransition(false);
        }
    }

    void BeginTransition(bool toAim)
    {
        _transitionToAim = toAim;
        _transitionTimer = 0f;
        CurrentMode      = SniperMode.Transitioning;
        OnTransitionStart.Invoke();
    }

    void HandleTransition()
    {
        if (CurrentMode != SniperMode.Transitioning) return;
        _transitionTimer += Time.deltaTime;
        float p = Mathf.Clamp01(_transitionTimer / modeTransitionDuration);
        OnTransitionProgress.Invoke(p);
        if (_transitionTimer >= modeTransitionDuration)
        {
            if (_transitionToAim) {
                CurrentMode = SniperMode.Aiming;
                if (_cam) _cam.fieldOfView = scopeFOV;
                OnEnteredAimMode.Invoke();
            } else {
                CurrentMode = SniperMode.Walking;
                if (_cam) _cam.fieldOfView = normalFOV;
                OnExitedAimMode.Invoke();
            }
        }
    }

    void HandleFire()
    {
        if (CurrentMode != SniperMode.Aiming) return;
        if (!_input.FireAction.WasPressedThisFrame()) return;
        if (!GameManager.Instance.IsPlaying) return;

        Ray ray = new(_cam.transform.position, _cam.transform.forward);
        bool hit = Physics.Raycast(ray, out RaycastHit hitInfo, maxShootRange, shootLayerMask);
        bool hitVIP = hit && hitInfo.collider.CompareTag("VIPTarget");
        string? hitTag = hit ? hitInfo.collider.tag : null;

        // DataChannel で射撃イベントをブロードキャスト
        RoomClient.Instance?.SendSniperFired(
            _cam.transform.position, _cam.transform.forward,
            hit, hit ? hitInfo.point : null, hitTag);

        if (hitVIP) {
            GameManager.Instance.ReportTargetEliminated();
            RoomClient.Instance?.SendGameEvent(DcGameEvent.TargetEliminated);
        } else {
            GameManager.Instance.ReportShotMissed();
            RoomClient.Instance?.SendGameEvent(DcGameEvent.ShotMissed);
        }
    }
}
