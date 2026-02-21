package com.neuralos.modules

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule

@ReactModule(name = SpeechRecognitionModule.NAME)
class SpeechRecognitionModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), RecognitionListener {

    companion object {
        const val NAME = "SpeechRecognition"
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun getName(): String = NAME

    // ─── Required for NativeEventEmitter in New Architecture ───

    @ReactMethod
    fun addListener(eventName: String) { /* no-op */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }

    // ─── Public API ────────────────────────────────────────────

    @ReactMethod
    fun isAvailable(promise: Promise) {
        promise.resolve(SpeechRecognizer.isRecognitionAvailable(reactContext))
    }

    @ReactMethod
    fun startListening(locale: String) {
        mainHandler.post {
            // Destroy any previous instance
            speechRecognizer?.destroy()
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext)
            speechRecognizer?.setRecognitionListener(this)

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            speechRecognizer?.startListening(intent)
        }
    }

    @ReactMethod
    fun stopListening() {
        mainHandler.post {
            speechRecognizer?.stopListening()
        }
    }

    @ReactMethod
    fun cancelListening() {
        mainHandler.post {
            speechRecognizer?.cancel()
            sendEvent("onSpeechCancel", null)
        }
    }

    @ReactMethod
    fun destroyRecognizer() {
        mainHandler.post {
            speechRecognizer?.destroy()
            speechRecognizer = null
        }
    }

    // ─── RecognitionListener callbacks ────────────────────────

    override fun onReadyForSpeech(params: Bundle?) {
        sendEvent("onSpeechStart", null)
    }

    override fun onBeginningOfSpeech() {}

    override fun onRmsChanged(rmsdB: Float) {
        val map = Arguments.createMap().apply {
            putDouble("value", rmsdB.toDouble())
        }
        sendEvent("onSpeechVolumeChanged", map)
    }

    override fun onBufferReceived(buffer: ByteArray?) {}

    override fun onEndOfSpeech() {
        sendEvent("onSpeechEnd", null)
    }

    override fun onError(error: Int) {
        android.util.Log.w("SpeechRecognition", "onError raw code: $error")
        val map = Arguments.createMap().apply {
            putString("error", error.toString())
        }
        sendEvent("onSpeechError", map)
    }

    override fun onResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val map = Arguments.createMap().apply {
            val arr = Arguments.createArray()
            matches?.forEach { arr.pushString(it) }
            putArray("value", arr)
        }
        sendEvent("onSpeechResults", map)
    }

    override fun onPartialResults(partialResults: Bundle?) {
        val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
        val map = Arguments.createMap().apply {
            val arr = Arguments.createArray()
            matches?.forEach { arr.pushString(it) }
            putArray("value", arr)
        }
        sendEvent("onSpeechPartialResults", map)
    }

    override fun onEvent(eventType: Int, params: Bundle?) {}

    // ─── Internal ──────────────────────────────────────────────

    private fun sendEvent(eventName: String, params: Any?) {
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    override fun onCatalystInstanceDestroy() {
        mainHandler.post {
            speechRecognizer?.destroy()
            speechRecognizer = null
        }
    }
}
