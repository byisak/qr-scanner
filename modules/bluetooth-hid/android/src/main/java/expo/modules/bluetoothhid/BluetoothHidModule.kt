package expo.modules.bluetoothhid

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothHidDevice
import android.bluetooth.BluetoothHidDeviceAppSdpSettings
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executors

/**
 * 휴대폰을 PC의 블루투스 키보드(HID Device 프로필, Android 9+)로 등록하고 글자를 입력한다.
 * - start(): 키보드로 등록 (앱 프로세스가 살아 있는 동안 유지)
 * - PC에서 처음 한 번 블루투스 장치 추가로 이 폰과 페어링 → 이후 connect(address)로 연결
 * - sendText(): 미국 자판 기준으로 키를 눌렀다 뗀다. 키보드로 칠 수 없는 글자(한글 등)는 건너뛴다
 * 권한(BLUETOOTH_CONNECT/ADVERTISE)은 JS에서 PermissionsAndroid로 먼저 받는다.
 */
@SuppressLint("MissingPermission")
class BluetoothHidModule : Module() {
  companion object {
    private const val EVENT_STATE = "onStateChange"
    private const val REPORT_ID = 1
    private const val KEY_DELAY_MS = 6L

    // 부트 키보드 (리포트 ID 1): 수정키 1바이트 + 예약 1 + 키 6
    private val DESCRIPTOR = byteArrayOf(
      0x05, 0x01, 0x09, 0x06, 0xA1.toByte(), 0x01, 0x85.toByte(), REPORT_ID.toByte(),
      0x05, 0x07, 0x19, 0xE0.toByte(), 0x29, 0xE7.toByte(), 0x15, 0x00, 0x25, 0x01, 0x75, 0x01, 0x95.toByte(), 0x08, 0x81.toByte(), 0x02,
      0x95.toByte(), 0x01, 0x75, 0x08, 0x81.toByte(), 0x01,
      0x95.toByte(), 0x05, 0x75, 0x01, 0x05, 0x08, 0x19, 0x01, 0x29, 0x05, 0x91.toByte(), 0x02,
      0x95.toByte(), 0x01, 0x75, 0x03, 0x91.toByte(), 0x01,
      0x95.toByte(), 0x06, 0x75, 0x08, 0x15, 0x00, 0x25, 0x65, 0x05, 0x07, 0x19, 0x00, 0x29, 0x65, 0x81.toByte(), 0x00,
      0xC0.toByte()
    )
    private const val SHIFT = 0x02

    // 글자 → (수정키, 키 사용 코드). 미국 자판
    private fun keyOf(c: Char): Pair<Int, Int>? = when (c) {
      in 'a'..'z' -> 0 to (0x04 + (c - 'a'))
      in 'A'..'Z' -> SHIFT to (0x04 + (c - 'A'))
      in '1'..'9' -> 0 to (0x1E + (c - '1'))
      '0' -> 0 to 0x27
      '\n' -> 0 to 0x28
      '\t' -> 0 to 0x2B
      ' ' -> 0 to 0x2C
      '-' -> 0 to 0x2D; '_' -> SHIFT to 0x2D
      '=' -> 0 to 0x2E; '+' -> SHIFT to 0x2E
      '[' -> 0 to 0x2F; '{' -> SHIFT to 0x2F
      ']' -> 0 to 0x30; '}' -> SHIFT to 0x30
      '\\' -> 0 to 0x31; '|' -> SHIFT to 0x31
      ';' -> 0 to 0x33; ':' -> SHIFT to 0x33
      '\'' -> 0 to 0x34; '"' -> SHIFT to 0x34
      '`' -> 0 to 0x35; '~' -> SHIFT to 0x35
      ',' -> 0 to 0x36; '<' -> SHIFT to 0x36
      '.' -> 0 to 0x37; '>' -> SHIFT to 0x37
      '/' -> 0 to 0x38; '?' -> SHIFT to 0x38
      '!' -> SHIFT to 0x1E; '@' -> SHIFT to 0x1F; '#' -> SHIFT to 0x20; '$' -> SHIFT to 0x21; '%' -> SHIFT to 0x22
      '^' -> SHIFT to 0x23; '&' -> SHIFT to 0x24; '*' -> SHIFT to 0x25; '(' -> SHIFT to 0x26; ')' -> SHIFT to 0x27
      else -> null
    }
  }

  private val executor = Executors.newSingleThreadExecutor()
  private var hid: BluetoothHidDevice? = null
  private var registered = false
  private var connected: BluetoothDevice? = null
  private var pendingStart: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No context")

  private fun adapter(): BluetoothAdapter? =
    (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

  private fun deviceJson(d: BluetoothDevice?): Map<String, Any?>? =
    d?.let { mapOf("name" to (it.name ?: it.address), "address" to it.address) }

  private fun emitState(state: String, device: BluetoothDevice?) {
    try {
      sendEvent(EVENT_STATE, mapOf("state" to state, "registered" to registered, "device" to deviceJson(device)))
    } catch (_: Throwable) {}
  }

  private val callback = object : BluetoothHidDevice.Callback() {
    override fun onAppStatusChanged(pluggedDevice: BluetoothDevice?, isRegistered: Boolean) {
      registered = isRegistered
      pendingStart?.resolve(isRegistered)
      pendingStart = null
      emitState(if (isRegistered) "registered" else "unregistered", pluggedDevice)
    }

    override fun onConnectionStateChanged(device: BluetoothDevice, state: Int) {
      when (state) {
        BluetoothProfile.STATE_CONNECTED -> { connected = device; emitState("connected", device) }
        BluetoothProfile.STATE_CONNECTING -> emitState("connecting", device)
        BluetoothProfile.STATE_DISCONNECTED -> { if (connected?.address == device.address) connected = null; emitState("disconnected", device) }
      }
    }
  }

  private fun register(promise: Promise) {
    val proxy = hid ?: return promise.resolve(false)
    if (registered) return promise.resolve(true)
    pendingStart = promise
    val sdp = BluetoothHidDeviceAppSdpSettings(
      "ScanView Keyboard", "Barcode scanner keyboard", "ScanView",
      BluetoothHidDevice.SUBCLASS1_KEYBOARD, DESCRIPTOR
    )
    val ok = proxy.registerApp(sdp, null, null, executor, callback)
    if (!ok) { pendingStart = null; promise.resolve(false) }
  }

  private fun sendKey(device: BluetoothDevice, modifier: Int, key: Int): Boolean {
    val proxy = hid ?: return false
    val down = byteArrayOf(modifier.toByte(), 0, key.toByte(), 0, 0, 0, 0, 0)
    val up = ByteArray(8)
    val a = proxy.sendReport(device, REPORT_ID, down)
    Thread.sleep(KEY_DELAY_MS)
    val b = proxy.sendReport(device, REPORT_ID, up)
    Thread.sleep(KEY_DELAY_MS)
    return a && b
  }

  override fun definition() = ModuleDefinition {
    Name("BluetoothHid")
    Events(EVENT_STATE)

    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && adapter() != null
    }

    Function("getStatus") {
      val a = adapter()
      mapOf(
        "supported" to (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && a != null),
        "bluetoothOn" to (a?.isEnabled == true),
        "registered" to registered,
        "device" to deviceJson(connected),
      )
    }

    // 키보드로 등록. 성공하면 true
    AsyncFunction("start") { promise: Promise ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return@AsyncFunction promise.resolve(false)
      val a = adapter() ?: return@AsyncFunction promise.resolve(false)
      if (!a.isEnabled) return@AsyncFunction promise.resolve(false)
      if (hid != null) return@AsyncFunction register(promise)
      val ok = a.getProfileProxy(context, object : BluetoothProfile.ServiceListener {
        override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
          if (profile == BluetoothProfile.HID_DEVICE) {
            hid = proxy as BluetoothHidDevice
            register(promise)
          }
        }
        override fun onServiceDisconnected(profile: Int) {
          if (profile == BluetoothProfile.HID_DEVICE) { hid = null; registered = false; connected = null; emitState("unregistered", null) }
        }
      }, BluetoothProfile.HID_DEVICE)
      if (!ok) promise.resolve(false)
    }

    AsyncFunction("stop") {
      try {
        connected?.let { hid?.disconnect(it) }
        hid?.unregisterApp()
        adapter()?.closeProfileProxy(BluetoothProfile.HID_DEVICE, hid)
      } catch (_: Throwable) {}
      hid = null; registered = false; connected = null
      true
    }

    // 이 폰과 페어링된 기기 (컴퓨터가 앞에)
    Function("getPairedDevices") {
      val list = adapter()?.bondedDevices?.toList() ?: emptyList()
      list.sortedBy { if (it.bluetoothClass?.majorDeviceClass == BluetoothClass.Device.Major.COMPUTER) 0 else 1 }
        .map { mapOf("name" to (it.name ?: it.address), "address" to it.address, "isComputer" to (it.bluetoothClass?.majorDeviceClass == BluetoothClass.Device.Major.COMPUTER)) }
    }

    AsyncFunction("connect") { address: String ->
      val proxy = hid ?: return@AsyncFunction false
      val device = adapter()?.getRemoteDevice(address) ?: return@AsyncFunction false
      proxy.connect(device)
    }

    AsyncFunction("disconnect") {
      val d = connected ?: return@AsyncFunction true
      hid?.disconnect(d) ?: true
    }

    // PC가 이 폰을 찾을 수 있게 (시스템 확인 창)
    Function("requestDiscoverable") { seconds: Int ->
      val activity = appContext.currentActivity ?: return@Function false
      val intent = Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE).putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, seconds)
      activity.startActivity(intent)
      true
    }

    // 글자 입력. 반환 { sent, skipped }
    AsyncFunction("sendText") { text: String ->
      val device = connected ?: return@AsyncFunction mapOf("sent" to 0, "skipped" to text.length, "connected" to false)
      var sent = 0
      var skipped = 0
      for (c in text) {
        val k = keyOf(c)
        if (k == null) { skipped++; continue }
        if (sendKey(device, k.first, k.second)) sent++ else skipped++
      }
      mapOf("sent" to sent, "skipped" to skipped, "connected" to true)
    }

    OnDestroy {
      try {
        hid?.unregisterApp()
        adapter()?.closeProfileProxy(BluetoothProfile.HID_DEVICE, hid)
      } catch (_: Throwable) {}
      hid = null; registered = false; connected = null
      executor.shutdown()
    }
  }
}
