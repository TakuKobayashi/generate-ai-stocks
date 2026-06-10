package com.example.clipboardmanager.keyboard

import android.inputmethodservice.InputMethodService
import android.inputmethodservice.Keyboard
import android.inputmethodservice.KeyboardView
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.LinearLayout
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.clipboardmanager.R
import com.example.clipboardmanager.data.AppDatabase
import kotlinx.coroutines.*

class ClipboardKeyboardIME : InputMethodService(), KeyboardView.OnKeyboardActionListener {
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private var keyboardView: KeyboardView? = null
    private var keyboard: Keyboard? = null
    private var clipboardRV: RecyclerView? = null
    private var adapter: ClipboardKeyboardAdapter? = null
    private var isClipboardVisible = false
    private var caps = false
    private lateinit var database: AppDatabase

    override fun onCreateInputView(): View {
        database = AppDatabase.getDatabase(applicationContext)
        val layout = layoutInflater.inflate(R.layout.keyboard_layout, null) as LinearLayout

        keyboardView = layout.findViewById(R.id.keyboard_view)
        keyboard = Keyboard(this, R.xml.qwerty_keyboard)
        keyboardView?.keyboard = keyboard
        keyboardView?.setOnKeyboardActionListener(this)

        clipboardRV = layout.findViewById(R.id.clipboard_recycler_view)
        clipboardRV?.layoutManager = LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false)
        adapter = ClipboardKeyboardAdapter { item ->
            currentInputConnection?.commitText(item.content, 1)
            scope.launch(Dispatchers.IO) { database.clipboardDao().insertOrUpdate(item.content) }
        }
        clipboardRV?.adapter = adapter
        loadFrequentlyUsed()
        return layout
    }

    override fun onStartInput(attribute: EditorInfo?, restarting: Boolean) {
        super.onStartInput(attribute, restarting)
        loadFrequentlyUsed()
    }

    private fun loadFrequentlyUsed() {
        scope.launch {
            val items = withContext(Dispatchers.IO) { database.clipboardDao().getFrequentlyUsed(2, 20) }
            adapter?.submitList(items)
        }
    }

    override fun onKey(primaryCode: Int, keyCodes: IntArray?) {
        when (primaryCode) {
            Keyboard.KEYCODE_DELETE -> currentInputConnection?.deleteSurroundingText(1, 0)
            Keyboard.KEYCODE_SHIFT -> { caps = !caps; keyboard?.isShifted = caps; keyboardView?.invalidateAllKeys() }
            Keyboard.KEYCODE_DONE -> currentInputConnection?.performEditorAction(EditorInfo.IME_ACTION_DONE)
            -100 -> {
                isClipboardVisible = !isClipboardVisible
                clipboardRV?.visibility = if (isClipboardVisible) View.VISIBLE else View.GONE
                if (isClipboardVisible) loadFrequentlyUsed()
            }
            else -> {
                var code = primaryCode.toChar()
                if (Character.isLetter(code) && caps) code = Character.toUpperCase(code)
                currentInputConnection?.commitText(code.toString(), 1)
            }
        }
    }

    override fun onDestroy() { super.onDestroy(); scope.cancel() }
    override fun onPress(primaryCode: Int) {}
    override fun onRelease(primaryCode: Int) {}
    override fun onText(text: CharSequence?) { currentInputConnection?.commitText(text, 1) }
    override fun swipeLeft() {}
    override fun swipeRight() {}
    override fun swipeDown() {}
    override fun swipeUp() {}
}
