package expo.modules.hardwarekeys

import android.view.KeyEvent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * 볼륨 키를 앱이 가로챈다. MainActivity.onKeyDown/onKeyUp 에서 handleKeyEvent 를 먼저 부르고
 * true 가 돌아오면 시스템 볼륨 처리를 하지 않는다 (plugins/withHardwareKeys.js 가 끼워 넣음).
 * JS 가 setCapturedKeys 로 넘긴 키만 가로채고, 비어 있으면 평소처럼 볼륨이 바뀐다.
 */
class HardwareKeysModule : Module() {
  companion object {
    private const val EVENT_NAME = "onHardwareKey"

    @Volatile
    private var capturedKeys: Set<String> = emptySet()

    @Volatile
    private var instance: HardwareKeysModule? = null

    private fun keyNameOf(keyCode: Int): String? = when (keyCode) {
      KeyEvent.KEYCODE_VOLUME_UP -> "volumeUp"
      KeyEvent.KEYCODE_VOLUME_DOWN -> "volumeDown"
      else -> null
    }

    /** 소비했으면 true. keyDown 의 첫 눌림(repeatCount 0)에서만 이벤트를 보내고 길게 누름 반복은 무시한다. */
    @JvmStatic
    fun handleKeyEvent(keyCode: Int, event: KeyEvent?): Boolean {
      val key = keyNameOf(keyCode) ?: return false
      if (!capturedKeys.contains(key)) return false
      if (event != null && event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
        instance?.emitKey(key)
      }
      return true
    }
  }

  private fun emitKey(key: String) {
    try {
      sendEvent(EVENT_NAME, mapOf("key" to key))
    } catch (_: Throwable) {
      // JS 쪽이 아직 준비되지 않았으면 조용히 버린다
    }
  }

  override fun definition() = ModuleDefinition {
    Name("HardwareKeys")

    Events(EVENT_NAME)

    OnCreate {
      instance = this@HardwareKeysModule
    }

    OnDestroy {
      if (instance === this@HardwareKeysModule) instance = null
      capturedKeys = emptySet()
    }

    Function("setCapturedKeys") { keys: List<String> ->
      capturedKeys = keys.toSet()
    }

    Function("getCapturedKeys") {
      capturedKeys.toList()
    }
  }
}
