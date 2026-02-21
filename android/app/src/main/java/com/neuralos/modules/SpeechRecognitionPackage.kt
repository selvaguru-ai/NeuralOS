package com.neuralos.modules

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SpeechRecognitionPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> {
        return listOf(SpeechRecognitionModule(context))
    }

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
