// =============================================================
//  lib/playcanvas/GameApp.ts
//  PlayCanvas Engine (npm) によるゲームシーン管理
//  PLATEAU 都市データ (glTF) の読み込み・FPS カメラ・ゴースト表示
// =============================================================

import * as pc from "playcanvas"
import type { RoomClient } from "../webrtc/RoomClient"
import type {
  DCPayload, DCSniperState, DCBodyguardState,
  SniperMode, Role,
} from "@plateau-sniper/shared"
import { DC } from "@plateau-sniper/shared"
import { encodePayload } from "../msgpack/codec"

// ─── Public STUN (参考用 / PlayCanvas 内では WebRTC は別管理) ──
// WebRTC は RoomClient が担当するため ここでは不使用

// ─── 定数 ────────────────────────────────────────────────────
const SEND_RATE_HZ  = 20          // 位置送信レート
const LERP_SPEED    = 10          // ゴースト補間速度
const SCOPE_FOV     = 15
const NORMAL_FOV    = 70
const TRANSITION_S  = 10          // モード切替時間

// ─── ゴースト状態 ─────────────────────────────────────────────
interface GhostState {
  entity:        pc.Entity
  targetPos:     pc.Vec3
  targetRot:     pc.Quat
  role:          Role
  lastUpdateMs:  number
}

// ─── メインクラス ─────────────────────────────────────────────
export class GameApp {
  private app:         pc.Application
  private camera:      pc.Entity
  private player:      pc.Entity
  private ghosts:      Map<string, GhostState> = new Map()

  // FPS 入力状態
  private keys:        Set<string> = new Set()
  private mouseDelta:  pc.Vec2     = new pc.Vec2()
  private vertAngle                = 0

  // スナイパーモード
  private sniperMode:  SniperMode  = "walking"
  private transTimer               = 0
  private transToAim               = false

  // 送信レート制御
  private sendTimer                = 0
  private readonly sendInterval    = 1 / SEND_RATE_HZ

  constructor(
    private readonly canvas:     HTMLCanvasElement,
    private readonly roomClient: RoomClient,
    private readonly role:       Role,
  ) {
    // ─── PlayCanvas アプリ初期化 ──────────────────────────
    this.app = new pc.Application(canvas, {
      mouse:   new pc.Mouse(canvas),
      touch:   new pc.TouchDevice(canvas),
      keyboard: new pc.Keyboard(window),
    })
    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW)
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO)

    // ─── カメラ ───────────────────────────────────────────
    this.camera = new pc.Entity("camera")
    this.camera.addComponent("camera", { fov: NORMAL_FOV, nearClip: 0.1, farClip: 2000 })
    this.app.root.addChild(this.camera)

    // ─── プレイヤー (不可視カプセル) ─────────────────────
    this.player = new pc.Entity("player")
    this.player.addComponent("rigidbody", { type: pc.BODYTYPE_DYNAMIC, linearDamping: 0.9 })
    this.player.addComponent("collision", { type: "capsule", radius: 0.3, height: 1.8 })
    this.player.setLocalPosition(0, 2, 0)
    this.app.root.addChild(this.player)
    this.camera.reparent(this.player)
    this.camera.setLocalPosition(0, 0.8, 0)

    // ─── ライト ───────────────────────────────────────────
    const light = new pc.Entity("light")
    light.addComponent("light", { type: "directional", color: new pc.Color(1, 1, 1), intensity: 1 })
    light.setEulerAngles(45, 45, 0)
    this.app.root.addChild(light)

    // ─── スカイボックス ───────────────────────────────────
    this.app.scene.ambientLight = new pc.Color(0.3, 0.35, 0.4)

    // ─── 入力設定 ─────────────────────────────────────────
    this.setupInput()

    // ─── ネットワーク受信 ─────────────────────────────────
    roomClient.on("message", ({ payload, from }) => this.handleNetMessage(payload, from))
    roomClient.on("peer_left", ({ clientId }) => this.removeGhost(clientId))

    // ─── ゲームループ ─────────────────────────────────────
    this.app.on("update", (dt: number) => this.update(dt))
    this.app.start()
  }

  // ─── PLATEAU glTF 読み込み ────────────────────────────────────
  loadPlateau(glbUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.app.assets.loadFromUrl(glbUrl, "container", (err, asset) => {
        if (err || !asset) { reject(err); return }
        const instance = (asset.resource as pc.ContainerResource).instantiateRenderEntity()
        instance.setLocalScale(0.01, 0.01, 0.01) // PLATEAU は cm 単位
        this.app.root.addChild(instance)
        resolve()
      })
    })
  }

  // ─── 入力 ────────────────────────────────────────────────────
  private setupInput() {
    window.addEventListener("keydown", e => this.keys.add(e.code))
    window.addEventListener("keyup",   e => this.keys.delete(e.code))

    // ポインターロック
    this.canvas.addEventListener("click", () => {
      this.canvas.requestPointerLock()
    })

    window.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.mouseDelta.x += e.movementX
        this.mouseDelta.y += e.movementY
      }
    })

    // スナイパー: 右クリックでモード切替
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault()
      if (this.role === "sniper") this.toggleSniperMode()
    })
  }

  // ─── メインループ ─────────────────────────────────────────────
  private update(dt: number) {
    this.handleMovement(dt)
    this.handleSniperTransition(dt)
    this.updateGhosts(dt)
    this.sendState(dt)

    // マウス delta をリセット
    this.mouseDelta.set(0, 0)
  }

  // ─── 移動 & 視点 ─────────────────────────────────────────────
  private readonly WALK_SPEED  = 4
  private readonly SPRINT_SPEED= 7
  private readonly MOUSE_SENS  = 0.15

  private handleMovement(dt: number) {
    const isAiming     = this.sniperMode === "aiming"
    const isTrans      = this.sniperMode === "transitioning"
    const speedMult    = isTrans ? 0.5 : 1.0
    const sprinting    = this.keys.has("ShiftLeft")
    const speed        = (sprinting ? this.SPRINT_SPEED : this.WALK_SPEED)
                         * speedMult * (isAiming ? 0 : 1)

    // 視点回転
    const sensitivity  = this.MOUSE_SENS
    this.vertAngle -= this.mouseDelta.y * sensitivity
    this.vertAngle  = Math.max(-80, Math.min(80, this.vertAngle))
    this.player.rotateLocal(0, -this.mouseDelta.x * sensitivity, 0)
    this.camera.setLocalEulerAngles(this.vertAngle, 0, 0)

    // 移動 (Aiming中は不可)
    if (!isAiming) {
      const fwd  = this.player.forward.clone()
      const right= this.player.right.clone()
      fwd.y = 0; right.y = 0
      fwd.normalize(); right.normalize()

      const move = new pc.Vec3()
      if (this.keys.has("KeyW")) move.add(fwd)
      if (this.keys.has("KeyS")) move.sub(fwd)
      if (this.keys.has("KeyA")) move.sub(right)
      if (this.keys.has("KeyD")) move.add(right)

      if (move.lengthSq() > 0) {
        move.normalize().scale(speed * dt)
        this.player.rigidbody?.applyForce(move.scale(1 / dt * 10))
      }
    }
  }

  // ─── スナイパーモード遷移 ─────────────────────────────────────
  private toggleSniperMode() {
    if (this.sniperMode === "transitioning") return
    this.transToAim  = this.sniperMode === "walking"
    this.transTimer  = 0
    this.sniperMode  = "transitioning"
  }

  private handleSniperTransition(dt: number) {
    if (this.sniperMode !== "transitioning") return
    this.transTimer += dt
    if (this.transTimer >= TRANSITION_S) {
      this.sniperMode = this.transToAim ? "aiming" : "walking"
      this.camera.camera!.fov = this.sniperMode === "aiming" ? SCOPE_FOV : NORMAL_FOV
    }
  }

  // ─── 射撃 (ボタン外部から呼ぶ) ───────────────────────────────
  fire() {
    if (this.role !== "sniper" || this.sniperMode !== "aiming") return

    // Raycast
    const from  = this.camera.getPosition()
    const dir   = this.camera.forward.clone()
    const result= this.app.systems.rigidbody!.raycastFirst(
      from, new pc.Vec3(from.x + dir.x * 500, from.y + dir.y * 500, from.z + dir.z * 500)
    )

    const hit    = !!result
    const hitTag = result?.entity?.tags?.has("VIPTarget") ? "VIPTarget" : undefined

    const payload = encodePayload({
      t:   DC.SNIPER_FIRED,
      ox: from.x, oy: from.y, oz: from.z,
      dx: dir.x,  dy: dir.y,  dz: dir.z,
      hit,
      hx: result?.point?.x, hy: result?.point?.y, hz: result?.point?.z,
      tag: hitTag,
    })

    this.roomClient.broadcast({
      t:   DC.SNIPER_FIRED,
      ox: from.x, oy: from.y, oz: from.z,
      dx: dir.x,  dy: dir.y,  dz: dir.z,
      hit,
      hx: result?.point?.x, hy: result?.point?.y, hz: result?.point?.z,
      tag: hitTag,
    })

    if (hitTag === "VIPTarget") {
      this.roomClient.broadcast({ t: DC.GAME_EVENT, ev: "target_eliminated" })
    } else {
      this.roomClient.broadcast({ t: DC.GAME_EVENT, ev: "shot_missed" })
    }
  }

  // ─── 状態送信 ─────────────────────────────────────────────────
  private sendState(dt: number) {
    this.sendTimer += dt
    if (this.sendTimer < this.sendInterval) return
    this.sendTimer = 0

    const pos = this.player.getPosition()
    const rot = this.player.getRotation()

    if (this.role === "sniper") {
      const tp = this.sniperMode === "transitioning"
        ? Math.min(1, this.transTimer / TRANSITION_S) : 0
      this.roomClient.broadcast({
        t: DC.SNIPER_STATE,
        px: pos.x, py: pos.y, pz: pos.z,
        qx: rot.x, qy: rot.y, qz: rot.z, qw: rot.w,
        mode: this.sniperMode,
        tp,
      } satisfies DCSniperState)
    } else {
      this.roomClient.broadcast({
        t:  DC.BODYGUARD_STATE,
        id: this.roomClient.clientId,
        px: pos.x, py: pos.y, pz: pos.z,
        qx: rot.x, qy: rot.y, qz: rot.z, qw: rot.w,
        sp: this.keys.has("ShiftLeft"),
      } satisfies DCBodyguardState)
    }
  }

  // ─── 受信メッセージ処理 ───────────────────────────────────────
  private handleNetMessage(payload: DCPayload, from: string) {
    switch (payload.t) {
      case DC.SNIPER_STATE:
        this.updateGhostState(from, "sniper", payload)
        break
      case DC.BODYGUARD_STATE:
        this.updateGhostState(from, "bodyguard", payload)
        break
      case DC.SNIPER_FIRED:
        this.onSniperFired?.(payload)
        break
      case DC.GAME_EVENT:
        this.onGameEvent?.(payload.ev)
        break
    }
  }

  // ─── ゴースト管理 ─────────────────────────────────────────────
  private updateGhostState(
    id:   string,
    role: Role,
    p:    DCSniperState | DCBodyguardState
  ) {
    if (!this.ghosts.has(id)) {
      const entity = new pc.Entity(`ghost_${id}`)
      entity.addComponent("model", { type: role === "sniper" ? "capsule" : "box" })
      // スナイパーは赤, ボディガードは青
      const mat = new pc.StandardMaterial()
      mat.diffuse = role === "sniper"
        ? new pc.Color(1, 0.2, 0.2, 0.6)
        : new pc.Color(0.2, 0.4, 1, 0.8)
      mat.opacity = 0.7
      mat.blendType = pc.BLEND_NORMAL
      mat.update()
      entity.model!.meshInstances.forEach(mi => mi.material = mat)
      this.app.root.addChild(entity)

      this.ghosts.set(id, {
        entity, role,
        targetPos: new pc.Vec3(p.px, p.py, p.pz),
        targetRot: new pc.Quat(p.qx, p.qy, p.qz, p.qw),
        lastUpdateMs: Date.now(),
      })
    }

    const ghost = this.ghosts.get(id)!
    ghost.targetPos.set(p.px, p.py, p.pz)
    ghost.targetRot.set(p.qx, p.qy, p.qz, p.qw)
    ghost.lastUpdateMs = Date.now()
  }

  private updateGhosts(dt: number) {
    const now = Date.now()
    for (const [id, ghost] of this.ghosts) {
      // 2秒以上更新なければ非表示
      ghost.entity.enabled = (now - ghost.lastUpdateMs) < 2000

      // 位置補間
      const pos = ghost.entity.getPosition()
      pos.lerp(pos, ghost.targetPos, Math.min(1, LERP_SPEED * dt))
      ghost.entity.setPosition(pos)

      const rot = ghost.entity.getRotation()
      rot.slerp(rot, ghost.targetRot, Math.min(1, LERP_SPEED * dt))
      ghost.entity.setRotation(rot)
    }
  }

  private removeGhost(id: string) {
    const ghost = this.ghosts.get(id)
    if (ghost) {
      ghost.entity.destroy()
      this.ghosts.delete(id)
    }
  }

  // ─── 外部コールバック ─────────────────────────────────────────
  onSniperFired?: (p: import("@plateau-sniper/shared").DCSniperFired) => void
  onGameEvent?:   (ev: string) => void

  getSniperMode() { return this.sniperMode }
  getTransitionProgress() {
    return this.sniperMode === "transitioning"
      ? Math.min(1, this.transTimer / TRANSITION_S) : 0
  }

  destroy() {
    this.app.destroy()
  }
}
