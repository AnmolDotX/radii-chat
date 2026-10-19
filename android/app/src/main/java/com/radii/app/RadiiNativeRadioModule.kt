package com.radii.app

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothServerSocket
import android.bluetooth.BluetoothSocket
import android.bluetooth.le.*
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.provider.MediaStore
import android.location.LocationManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.ParcelUuid
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Inet4Address
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.EOFException
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import android.app.Activity
import java.io.File
import android.media.MediaRecorder
import android.media.MediaPlayer
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Environment
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import android.content.pm.PackageManager
import android.Manifest
import java.util.*
import kotlin.concurrent.thread

@SuppressLint("MissingPermission")
class RadiiNativeRadioModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    init {
        reactContext.addActivityEventListener(this)
    }

    private var documentPickerPromise: Promise? = null
    private val REQUEST_CODE_PICK_DOCUMENT = 9921

    override fun getName(): String = "RadiiNativeRadio"

    companion object {
        // Reserved Company Identifier for Radii Mesh (0x11FD)
        const val RADII_COMPANY_ID = 0x11FD
        // Protocol byte version
        const val PROTOCOL_VERSION: Byte = 0x01
    }

    // Compact 16-bit equivalent Service UUID reserved for Radii app peers
    private val SERVICE_UUID: UUID = UUID.fromString("0000fd11-0000-1000-8000-00805f9b34fb")
    private val SERVICE_PARCEL_UUID = ParcelUuid(SERVICE_UUID)
    private val NAME_UUID: UUID = UUID.fromString("0000fd12-0000-1000-8000-00805f9b34fb")
    private val NAME_PARCEL_UUID = ParcelUuid(NAME_UUID)
    private val MESSAGE_CHAR_UUID: UUID = UUID.fromString("0000fd13-0000-1000-8000-00805f9b34fb")
    private val UDP_PORT = 41234

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bleAdvertiser: BluetoothLeAdvertiser? = null
    private var bleScanner: BluetoothLeScanner? = null
    private var gattServer: BluetoothGattServer? = null

    private var advertiseCallback: AdvertiseCallback? = null
    private var scanCallback: ScanCallback? = null

    private var rfcommServerSocket: BluetoothServerSocket? = null
    private var isRfcommListening = false
    private val outboundRfcommSockets = ConcurrentHashMap<String, BluetoothSocket>()

    private var udpSocket: DatagramSocket? = null
    private var udpBroadcastThread: Thread? = null
    private var udpListenThread: Thread? = null
    private var isBroadcasting = false
    private var isListening = false
    private var multicastLock: WifiManager.MulticastLock? = null

    private var currentPeerId = ""
    private var currentDisplayName = ""
    private var receiverRegistered = false

    private val bluetoothReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == BluetoothAdapter.ACTION_STATE_CHANGED) {
                val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)
                if (state == BluetoothAdapter.STATE_ON) {
                    Log.d("RadiiRadio", "Bluetooth turned ON. Refreshing adapter & auto-starting radios...")
                    refreshBluetoothAdapter()
                    if (currentPeerId.isNotEmpty()) {
                        internalStartAdvertising(currentPeerId, currentDisplayName)
                        internalStartScanning()
                    }
                }
            }
        }
    }

    init {
        try {
            refreshBluetoothAdapter()
            val filter = IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactContext.registerReceiver(bluetoothReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                reactContext.registerReceiver(bluetoothReceiver, filter)
            }
            receiverRegistered = true
        } catch (e: Exception) {
            Log.e("RadiiRadio", "Error in init", e)
        }
    }

    override fun invalidate() {
        super.invalidate()
        if (receiverRegistered) {
            try {
                reactContext.unregisterReceiver(bluetoothReceiver)
                receiverRegistered = false
            } catch (e: Exception) {}
        }
        internalStopScanning()
        internalStopAdvertising()
    }

    private fun refreshBluetoothAdapter(): BluetoothAdapter? {
        try {
            val bm = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            bluetoothAdapter = bm?.adapter ?: BluetoothAdapter.getDefaultAdapter()
        } catch (e: Exception) {
            Log.e("RadiiRadio", "refreshBluetoothAdapter error", e)
        }
        return bluetoothAdapter
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
        } catch (e: Exception) {
            // Context might not be active
        }
    }

    private fun calculateDistanceBracket(rssi: Int): String {
        return when {
            rssi >= -55 -> "immediate"
            rssi >= -72 -> "near"
            rssi >= -85 -> "mid"
            else -> "far"
        }
    }

    @ReactMethod
    fun enableHardwareRadios(promise: Promise) {
        try {
            val adapter = refreshBluetoothAdapter()
            var bluetoothPrompted = false
            if (adapter != null && !adapter.isEnabled) {
                val enableIntent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
                enableIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(enableIntent)
                bluetoothPrompted = true
            }

            val wifiManager = reactContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            val isWifiOn = wifiManager?.isWifiEnabled == true
            var wifiPrompted = false
            if (!isWifiOn) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        val panelIntent = Intent(Settings.Panel.ACTION_WIFI).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        reactContext.startActivity(panelIntent)
                        wifiPrompted = true
                    } catch (e: Exception) {
                        val wifiSettingsIntent = Intent(Settings.ACTION_WIFI_SETTINGS).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        reactContext.startActivity(wifiSettingsIntent)
                        wifiPrompted = true
                    }
                } else {
                    @Suppress("DEPRECATION")
                    wifiManager?.isWifiEnabled = true
                    wifiPrompted = true
                }
            }

            val lm = reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            val isGpsOn = lm?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true ||
                    lm?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true
            var locationPrompted = false

            if (!isGpsOn) {
                Log.w("RadiiRadio", "WARNING: Android Master Location toggle is OFF! Android will suppress BLE scan results.")
                try {
                    val locIntent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactContext.startActivity(locIntent)
                    locationPrompted = true
                } catch (e: Exception) {}
            }

            val result = Arguments.createMap()
            result.putBoolean("bluetoothEnabled", adapter?.isEnabled == true)
            result.putBoolean("bluetoothPrompted", bluetoothPrompted)
            result.putBoolean("wifiEnabled", isWifiOn)
            result.putBoolean("wifiPrompted", wifiPrompted)
            result.putBoolean("locationEnabled", isGpsOn)
            result.putBoolean("locationPrompted", locationPrompted)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ENABLE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openLocationSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun startAdvertising(peerId: String, displayName: String, promise: Promise) {
        val success = internalStartAdvertising(peerId, displayName)
        promise.resolve(success)
    }

    private fun internalStartAdvertising(peerId: String, displayName: String): Boolean {
        try {
            currentPeerId = peerId
            currentDisplayName = displayName

            val adapter = refreshBluetoothAdapter()
            if (adapter != null && adapter.isEnabled) {
                bleAdvertiser = adapter.bluetoothLeAdvertiser
                if (bleAdvertiser != null) {
                    // Stop any existing callback first
                    if (advertiseCallback != null) {
                        try {
                            bleAdvertiser?.stopAdvertising(advertiseCallback)
                        } catch (e: Exception) {}
                        advertiseCallback = null
                    }

                    val settings = AdvertiseSettings.Builder()
                        .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                        .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                        .setConnectable(true)
                        .setTimeout(0)
                        .build()

                    val shortId = peerId.takeLast(6).lowercase()
                    val shortIdBytes = shortId.toByteArray(Charsets.UTF_8)

                    val safeName = (if (displayName.isNotBlank()) displayName.trim() else "Radii User")
                    // Safe string truncation by characters to avoid splitting multi-byte UTF-8
                    val trimmedName = if (safeName.length > 10) safeName.substring(0, 10) else safeName
                    val nameBytes = trimmedName.toByteArray(Charsets.UTF_8)

                    val mfgPayload = ByteArray(1 + 6 + nameBytes.size)
                    mfgPayload[0] = PROTOCOL_VERSION
                    System.arraycopy(shortIdBytes, 0, mfgPayload, 1, 6)
                    if (nameBytes.isNotEmpty()) {
                        System.arraycopy(nameBytes, 0, mfgPayload, 7, nameBytes.size)
                    }

                    val primaryData = AdvertiseData.Builder()
                        .setIncludeDeviceName(false)
                        .setIncludeTxPowerLevel(false)
                        .addManufacturerData(RADII_COMPANY_ID, mfgPayload)
                        .addServiceUuid(SERVICE_PARCEL_UUID)
                        .build()

                    val scanResponseData = AdvertiseData.Builder()
                        .setIncludeDeviceName(false)
                        .setIncludeTxPowerLevel(false)
                        .addServiceUuid(NAME_PARCEL_UUID)
                        .build()

                    val callback = object : AdvertiseCallback() {
                        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                            super.onStartSuccess(settingsInEffect)
                            Log.d("RadiiRadio", "Radii BLE Advertiser active (mfgPayload=${mfgPayload.size}b, shortId=$shortId, name=$trimmedName)")
                        }

                        override fun onStartFailure(errorCode: Int) {
                            super.onStartFailure(errorCode)
                            Log.e("RadiiRadio", "Radii BLE Advertiser failed code: $errorCode")
                        }
                    }

                    advertiseCallback = callback
                    bleAdvertiser?.startAdvertising(settings, primaryData, scanResponseData, callback)
                }

                // Start RFCOMM Bluetooth listener for direct peer-to-peer messaging
                startRfcommServer()

                // Start BLE GATT server for low-energy packet writing
                startGattServer()
            }

            // Also start local UDP subnet broadcast mesh
            startUdpBroadcast(peerId, displayName)

            return true
        } catch (e: Exception) {
            Log.e("RadiiRadio", "internalStartAdvertising error", e)
            return false
        }
    }

    private fun startGattServer() {
        if (gattServer != null) return
        try {
            val bm = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return
            val callback = object : BluetoothGattServerCallback() {
                override fun onCharacteristicWriteRequest(
                    device: BluetoothDevice?,
                    requestId: Int,
                    characteristic: BluetoothGattCharacteristic?,
                    preparedWrite: Boolean,
                    responseNeeded: Boolean,
                    offset: Int,
                    value: ByteArray?
                ) {
                    super.onCharacteristicWriteRequest(device, requestId, characteristic, preparedWrite, responseNeeded, offset, value)
                    if (responseNeeded && device != null) {
                        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
                    }
                    if (value != null && value.isNotEmpty()) {
                        val rawText = String(value, Charsets.UTF_8)
                        dispatchIncomingMessage(rawText, "ble")
                    }
                }
            }

            gattServer = bm.openGattServer(reactContext, callback)
            val service = BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)
            val char = BluetoothGattCharacteristic(
                MESSAGE_CHAR_UUID,
                BluetoothGattCharacteristic.PROPERTY_WRITE or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
                BluetoothGattCharacteristic.PERMISSION_WRITE
            )
            service.addCharacteristic(char)
            gattServer?.addService(service)
            Log.d("RadiiRadio", "Radii BLE GATT Server active on 0xFD11 / 0xFD13")
        } catch (e: Exception) {
            Log.e("RadiiRadio", "Error starting GATT Server", e)
        }
    }

    @ReactMethod
    fun startScanning(promise: Promise) {
        val success = internalStartScanning()
        promise.resolve(success)
    }

    private fun internalStartScanning(): Boolean {
        try {
            val adapter = refreshBluetoothAdapter()
            if (adapter != null && adapter.isEnabled) {
                bleScanner = adapter.bluetoothLeScanner
                if (bleScanner != null) {
                    if (scanCallback != null) {
                        try {
                            bleScanner?.stopScan(scanCallback)
                        } catch (e: Exception) {}
                        scanCallback = null
                    }

                    val settingsBuilder = ScanSettings.Builder()
                        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                        .setReportDelay(0)

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        settingsBuilder.setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
                        settingsBuilder.setNumOfMatches(ScanSettings.MATCH_NUM_MAX_ADVERTISEMENT)
                        settingsBuilder.setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
                    }
                    val settings = settingsBuilder.build()

                    val callback = object : ScanCallback() {
                        override fun onScanResult(callbackType: Int, result: ScanResult?) {
                            result?.let { handleBleScanResult(it) }
                        }

                        override fun onBatchScanResults(results: MutableList<ScanResult>?) {
                            results?.forEach { handleBleScanResult(it) }
                        }

                        override fun onScanFailed(errorCode: Int) {
                            super.onScanFailed(errorCode)
                            Log.e("RadiiRadio", "Radii BLE Scan failed code: $errorCode")
                        }
                    }

                    scanCallback = callback
                    // Pass null as filters so Android BLE subsystem delivers all packets
                    // without chipset-level hardware APCF mask rejection
                    bleScanner?.startScan(null, settings, callback)
                    Log.d("RadiiRadio", "Radii BLE Scanner active (Continuous zero-drop hardware reception)")
                } else {
                    Log.w("RadiiRadio", "bleScanner is null (Bluetooth may be busy or initializing)")
                }
            } else {
                Log.w("RadiiRadio", "Bluetooth is OFF or adapter unavailable")
            }

            // Start UDP listener on local Wi-Fi / Hotspot
            startUdpListener()

            return true
        } catch (e: Exception) {
            Log.e("RadiiRadio", "internalStartScanning error", e)
            return false
        }
    }

    private fun handleBleScanResult(result: ScanResult) {
        try {
            val device = result.device ?: return
            val record = result.scanRecord ?: return

            var remoteShortId = ""
            var peerName = ""

            // 1. Check Radii Manufacturer Data (0x11FD)
            val mfgBytes = record.getManufacturerSpecificData(RADII_COMPANY_ID)
            if (mfgBytes != null && mfgBytes.size >= 7) {
                // Byte 0 is protocol version
                remoteShortId = String(mfgBytes, 1, 6, Charsets.UTF_8).trim().lowercase()
                if (mfgBytes.size > 7) {
                    peerName = String(mfgBytes, 7, mfgBytes.size - 7, Charsets.UTF_8).trim()
                }
            }

            // 2. Fallback: Check service data 0xFD11 for backwards compatibility
            if (remoteShortId.isEmpty()) {
                val serviceDataBytes = record.serviceData[SERVICE_PARCEL_UUID]
                if (serviceDataBytes != null && serviceDataBytes.isNotEmpty()) {
                    remoteShortId = String(serviceDataBytes, Charsets.UTF_8).trim().lowercase()
                }
            }

            val hasServiceUuid = record.serviceUuids?.contains(SERVICE_PARCEL_UUID) == true

            // Ignore non-Radii devices (smart TVs, headphones, fitness bands, etc.)
            if (remoteShortId.isEmpty() && !hasServiceUuid && mfgBytes == null) {
                return
            }

            // STRICT FILTER: Discard own device loopback
            val myShortId = currentPeerId.takeLast(6).lowercase()
            if (remoteShortId.isNotEmpty() && myShortId.isNotEmpty() && remoteShortId == myShortId) {
                return // Loopback of own broadcast
            }

            val rssi = result.rssi
            val distanceBracket = calculateDistanceBracket(rssi)
            val shortId = if (remoteShortId.isNotEmpty()) remoteShortId else device.address.replace(":", "").takeLast(6).lowercase()
            val stableId = "peer_$shortId"

            if (peerName.isEmpty()) {
                val nameBytes = record.serviceData[NAME_PARCEL_UUID]
                peerName = if (nameBytes != null && nameBytes.isNotEmpty()) {
                    String(nameBytes, Charsets.UTF_8).trim().ifEmpty { "Radii·$shortId" }
                } else if (remoteShortId.isNotEmpty()) {
                    "Radii·$remoteShortId"
                } else {
                    "Nearby Radii Companion"
                }
            }

            Log.d("RadiiRadio", "Discovered Radii peer: id=$stableId, shortId=$shortId, name=$peerName, rssi=$rssi")

            val map = Arguments.createMap().apply {
                putString("id", stableId)
                putString("shortId", shortId)
                putString("name", peerName)
                putString("platform", "android")
                putString("activeTransport", "ble")
                putInt("rssi", rssi)
                putString("distanceBracket", distanceBracket)
                putDouble("lastSeen", System.currentTimeMillis().toDouble())
                putBoolean("isPaired", false)
                putString("avatarSeed", peerName)
                putString("deviceName", "Radii Radio")
                putString("statusMessage", "Offline Radio Antenna ($rssi dBm)")
                putString("macAddress", device.address)
            }

            sendEvent("onPeerDiscovered", map)
        } catch (e: Exception) {
            Log.e("RadiiRadio", "Error parsing BLE scan result", e)
        }
    }

    private fun dispatchIncomingMessage(jsonString: String, transport: String) {
        try {
            val json = JSONObject(jsonString)
            val senderId = json.optString("senderId")
            if (senderId.isEmpty()) return

            val myShortId = currentPeerId.takeLast(6).lowercase()
            val senderShortId = json.optString("senderShortId").ifEmpty { senderId.takeLast(6) }.lowercase()

            // Discard self-loopback
            if (senderId == currentPeerId || (myShortId.isNotEmpty() && senderShortId == myShortId)) {
                return
            }

            val targetPeerId = json.optString("targetPeerId")
            val targetShortId = json.optString("targetShortId").ifEmpty {
                if (targetPeerId.isNotEmpty()) targetPeerId.takeLast(6) else ""
            }.lowercase()

            val isRoom = json.has("roomId") || json.has("roomCode") ||
                         json.optString("roomId").isNotEmpty() || json.optString("roomCode").isNotEmpty()

            // If a specific target is set and does not match our device, discard (unless it's a room broadcast)
            if (!isRoom && targetShortId.isNotEmpty() && myShortId.isNotEmpty() && targetShortId != myShortId) {
                return
            }

            val canonicalSenderId = "peer_$senderShortId"
            val msgType = json.optString("type", "CHAT_MSG")

            val map = Arguments.createMap().apply {
                putString("id", json.optString("id", UUID.randomUUID().toString()))
                putString("conversationId", canonicalSenderId)
                putString("senderId", canonicalSenderId)
                putString("senderShortId", senderShortId)
                putString("fullSenderId", senderId)
                putString("senderName", json.optString("senderName", "Nearby Companion"))
                putString("text", json.optString("text"))
                putString("type", msgType)
                putString("targetPeerId", targetPeerId)
                putString("targetShortId", targetShortId)
                putString("verificationCode", json.optString("verificationCode", ""))
                putString("senderDevice", json.optString("senderDevice", ""))
                putString("ackMessageId", json.optString("ackMessageId", ""))
                putDouble("timestamp", json.optDouble("timestamp", System.currentTimeMillis().toDouble()))
                putString("transport", transport)
                putString("status", "delivered")
                putBoolean("isMe", false)

                // Preserve all extra payload fields (roomId, roomName, isVoice, isImage, transferId, etc.)
                val keys = json.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    if (!hasKey(key)) {
                        when (val v = json.get(key)) {
                            is String -> putString(key, v)
                            is Int -> putInt(key, v)
                            is Long -> putDouble(key, v.toDouble())
                            is Double -> putDouble(key, v)
                            is Boolean -> putBoolean(key, v)
                        }
                    }
                }
            }

            sendEvent("onMessageReceived", map)
        } catch (e: Exception) {
            Log.e("RadiiRadio", "dispatchIncomingMessage error", e)
        }
    }

    private fun startRfcommServer() {
        if (isRfcommListening) return
        isRfcommListening = true

        thread(start = true, isDaemon = true) {
            try {
                val adapter = refreshBluetoothAdapter() ?: return@thread
                rfcommServerSocket = adapter.listenUsingInsecureRfcommWithServiceRecord("RadiiMesh", SERVICE_UUID)
                Log.d("RadiiRadio", "RFCOMM Server listening on port for incoming connections")

                while (isRfcommListening) {
                    val socket = rfcommServerSocket?.accept() ?: break
                    handleIncomingRfcommSocket(socket)
                }
            } catch (e: Exception) {
                Log.d("RadiiRadio", "RFCOMM Server socket closed")
            } finally {
                isRfcommListening = false
            }
        }
    }

    private fun getOrCreateOutboundSocket(macAddress: String): BluetoothSocket? {
        val existing = outboundRfcommSockets[macAddress]
        if (existing != null && existing.isConnected) {
            return existing
        }
        try { existing?.close() } catch (e: Exception) {}
        outboundRfcommSockets.remove(macAddress)

        val adapter = refreshBluetoothAdapter() ?: return null
        val device = adapter.getRemoteDevice(macAddress)
        val socket = device.createInsecureRfcommSocketToServiceRecord(SERVICE_UUID)
        socket.connect()
        outboundRfcommSockets[macAddress] = socket
        return socket
    }

    private fun handleIncomingRfcommSocket(socket: BluetoothSocket) {
        thread(start = true, isDaemon = true) {
            try {
                val dis = DataInputStream(socket.inputStream)
                while (true) {
                    val length = try {
                        dis.readInt()
                    } catch (eof: EOFException) {
                        break
                    }
                    if (length <= 0 || length > 25 * 1024 * 1024) break
                    val buffer = ByteArray(length)
                    dis.readFully(buffer)
                    val rawText = String(buffer, Charsets.UTF_8)
                    dispatchIncomingMessage(rawText, "nearby")
                }
            } catch (e: Exception) {
                Log.d("RadiiRadio", "Incoming RFCOMM socket stream closed: ${e.message}")
            } finally {
                try { socket.close() } catch (e: Exception) {}
            }
        }
    }

    @ReactMethod
    fun sendBluetoothMessage(macAddress: String, messageJson: String, promise: Promise) {
        thread(start = true, isDaemon = true) {
            synchronized(outboundRfcommSockets) {
                try {
                    var socket = getOrCreateOutboundSocket(macAddress)
                    if (socket == null) {
                        promise.resolve(false)
                        return@thread
                    }

                    val bytes = messageJson.toByteArray(Charsets.UTF_8)
                    try {
                        val dos = DataOutputStream(socket.outputStream)
                        dos.writeInt(bytes.size)
                        dos.write(bytes)
                        dos.flush()
                        promise.resolve(true)
                        return@thread
                    } catch (ioe: IOException) {
                        Log.w("RadiiRadio", "RFCOMM socket write failed, reconnecting once: ${ioe.message}")
                        try { socket.close() } catch (e: Exception) {}
                        outboundRfcommSockets.remove(macAddress)
                        socket = getOrCreateOutboundSocket(macAddress)
                        if (socket != null) {
                            val dos = DataOutputStream(socket.outputStream)
                            dos.writeInt(bytes.size)
                            dos.write(bytes)
                            dos.flush()
                            promise.resolve(true)
                            return@thread
                        }
                    }
                    promise.resolve(false)
                } catch (e: Exception) {
                    Log.e("RadiiRadio", "sendBluetoothMessage failed: ${e.message}")
                    promise.resolve(false)
                }
            }
        }
    }

    @ReactMethod
    fun sendBleMessage(macAddress: String, messageJson: String, promise: Promise) {
        thread(start = true, isDaemon = true) {
            try {
                val adapter = refreshBluetoothAdapter() ?: return@thread promise.resolve(false)
                val device = adapter.getRemoteDevice(macAddress)
                val bytes = messageJson.toByteArray(Charsets.UTF_8)
                var resolved = false

                val gattCallback = object : BluetoothGattCallback() {
                    override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
                        if (newState == BluetoothGatt.STATE_CONNECTED) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                                gatt?.requestMtu(512)
                            } else {
                                gatt?.discoverServices()
                            }
                        } else if (newState == BluetoothGatt.STATE_DISCONNECTED) {
                            try { gatt?.close() } catch (e: Exception) {}
                            if (!resolved) {
                                resolved = true
                                promise.resolve(false)
                            }
                        }
                    }

                    override fun onMtuChanged(gatt: BluetoothGatt?, mtu: Int, status: Int) {
                        super.onMtuChanged(gatt, mtu, status)
                        gatt?.discoverServices()
                    }

                    override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
                        if (status == BluetoothGatt.GATT_SUCCESS && gatt != null) {
                            val service = gatt.getService(SERVICE_UUID)
                            val characteristic = service?.getCharacteristic(MESSAGE_CHAR_UUID)
                            if (characteristic != null) {
                                characteristic.value = bytes
                                characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                                val success = gatt.writeCharacteristic(characteristic)
                                if (!resolved) {
                                    resolved = true
                                    promise.resolve(success)
                                }
                                try { gatt.disconnect() } catch (e: Exception) {}
                                return
                            }
                        }
                        try { gatt?.disconnect() } catch (e: Exception) {}
                        if (!resolved) {
                            resolved = true
                            promise.resolve(false)
                        }
                    }
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    device.connectGatt(reactContext, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
                } else {
                    device.connectGatt(reactContext, false, gattCallback)
                }
            } catch (e: Exception) {
                Log.e("RadiiRadio", "sendBleMessage error: ${e.message}")
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun sendUdpMessage(ipAddress: String, messageJson: String, promise: Promise) {
        thread(start = true, isDaemon = true) {
            var socket: DatagramSocket? = null
            try {
                socket = DatagramSocket()
                val bytes = messageJson.toByteArray(Charsets.UTF_8)
                val targetAddr = InetAddress.getByName(ipAddress)
                val packet = DatagramPacket(bytes, bytes.size, targetAddr, UDP_PORT)
                socket.send(packet)
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e("RadiiRadio", "sendUdpMessage error: ${e.message}")
                promise.resolve(false)
            } finally {
                socket?.close()
            }
        }
    }

    @ReactMethod
    fun broadcastUdpMessage(messageJson: String, promise: Promise) {
        thread(start = true, isDaemon = true) {
            var socket: DatagramSocket? = null
            try {
                socket = DatagramSocket()
                socket.broadcast = true
                val bytes = messageJson.toByteArray(Charsets.UTF_8)
                val broadcastTargets = getSubnetBroadcastAddresses()
                for (target in broadcastTargets) {
                    try {
                        val packet = DatagramPacket(bytes, bytes.size, target, UDP_PORT)
                        socket.send(packet)
                    } catch (e: Exception) {}
                }
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e("RadiiRadio", "broadcastUdpMessage error: ${e.message}")
                promise.resolve(false)
            } finally {
                socket?.close()
            }
        }
    }

    private fun getSubnetBroadcastAddresses(): List<InetAddress> {
        val addresses = mutableListOf<InetAddress>()
        try {
            addresses.add(InetAddress.getByName("255.255.255.255"))
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val netIf = interfaces.nextElement()
                if (netIf.isLoopback || !netIf.isUp) continue
                for (ifAddr in netIf.interfaceAddresses) {
                    val broadcast = ifAddr.broadcast
                    if (broadcast != null) {
                        addresses.add(broadcast)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("RadiiRadio", "Error finding broadcast addresses", e)
        }
        return addresses.distinct()
    }

    private fun startUdpBroadcast(peerId: String, name: String) {
        if (isBroadcasting) return
        isBroadcasting = true

        udpBroadcastThread = thread(start = true, isDaemon = true) {
            var socket: DatagramSocket? = null
            try {
                socket = DatagramSocket()
                socket.broadcast = true

                while (isBroadcasting) {
                    val broadcastTargets = getSubnetBroadcastAddresses()
                    val localIp = getLocalIpAddress()
                    val json = JSONObject().apply {
                        put("type", "RADII_BEACON")
                        put("id", peerId)
                        put("name", name)
                        put("platform", "android")
                        put("device", Build.MODEL ?: "Android")
                        put("timestamp", System.currentTimeMillis())
                        if (localIp != null) put("ipAddress", localIp)
                    }

                    val bytes = json.toString().toByteArray(Charsets.UTF_8)
                    for (target in broadcastTargets) {
                        try {
                            val packet = DatagramPacket(bytes, bytes.size, target, UDP_PORT)
                            socket.send(packet)
                        } catch (e: Exception) {
                            // Interface might not support broadcast
                        }
                    }
                    Thread.sleep(2000)
                }
            } catch (e: Exception) {
                // Socket stopped
            } finally {
                socket?.close()
            }
        }
    }

    private fun startUdpListener() {
        if (isListening) return
        isListening = true

        try {
            val wifi = reactContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            multicastLock = wifi?.createMulticastLock("radii_lock")?.apply {
                setReferenceCounted(true)
                acquire()
            }
        } catch (e: Exception) {
            Log.e("RadiiRadio", "Could not acquire MulticastLock", e)
        }

        udpListenThread = thread(start = true, isDaemon = true) {
            try {
                val socket = DatagramSocket(null).apply {
                    reuseAddress = true
                    bind(InetSocketAddress(UDP_PORT))
                    broadcast = true
                }
                udpSocket = socket
                val buffer = ByteArray(65535)
                Log.d("RadiiRadio", "UDP Mesh listener active on port $UDP_PORT (reuseAddress=true)")

                while (isListening) {
                    try {
                        val packet = DatagramPacket(buffer, buffer.size)
                        socket.receive(packet)

                        val text = String(packet.data, 0, packet.length, Charsets.UTF_8)
                        val json = JSONObject(text)
                        val msgType = json.optString("type")

                        if (msgType == "RADII_BEACON") {
                            val peerId = json.optString("id")
                            val peerName = json.optString("name", "Nearby Radii User")
                            val deviceModel = json.optString("device", "Local Mesh")

                            // STRICT FILTER: Ignore own beacon
                            if (peerId.isNotEmpty() && (peerId == currentPeerId || peerId.takeLast(6) == currentPeerId.takeLast(6))) {
                                continue
                            }

                            val shortId = peerId.takeLast(6)
                            val stableId = "peer_$shortId"

                            val map = Arguments.createMap().apply {
                                putString("id", stableId)
                                putString("shortId", shortId)
                                putString("fullUserId", peerId)
                                putString("name", peerName)
                                putString("platform", json.optString("platform", "android"))
                                putString("activeTransport", "nearby")
                                putInt("rssi", -48)
                                putString("distanceBracket", "immediate")
                                putDouble("lastSeen", System.currentTimeMillis().toDouble())
                                putBoolean("isPaired", false)
                                putString("avatarSeed", peerName)
                                putString("deviceName", deviceModel)
                                putString("statusMessage", "Direct Local Radio Mesh")
                                putString("ipAddress", packet.address.hostAddress)
                            }
                            sendEvent("onPeerDiscovered", map)
                        } else if (msgType.isNotEmpty()) {
                            dispatchIncomingMessage(text, "nearby")
                        }
                    } catch (e: Exception) {
                        Log.e("RadiiRadio", "Error handling UDP packet", e)
                    }
                }
            } catch (e: Exception) {
                Log.e("RadiiRadio", "UDP listener socket exception", e)
            } finally {
                udpSocket?.close()
                udpSocket = null
                try {
                    multicastLock?.release()
                } catch (e: Exception) {}
            }
        }
    }

    @ReactMethod
    fun stopScanning(promise: Promise) {
        val success = internalStopScanning()
        promise.resolve(success)
    }

    private fun internalStopScanning(): Boolean {
        try {
            scanCallback?.let {
                try {
                    bleScanner?.stopScan(it)
                } catch (e: Exception) {}
                scanCallback = null
            }
            isListening = false
            try {
                udpSocket?.close()
                udpSocket = null
            } catch (e: Exception) {}
            try {
                multicastLock?.let {
                    if (it.isHeld) it.release()
                }
            } catch (e: Exception) {}
            return true
        } catch (e: Exception) {
            return false
        }
    }

    @ReactMethod
    fun stopAdvertising(promise: Promise) {
        val success = internalStopAdvertising()
        promise.resolve(success)
    }

    private fun internalStopAdvertising(): Boolean {
        try {
            advertiseCallback?.let {
                try {
                    bleAdvertiser?.stopAdvertising(it)
                } catch (e: Exception) {}
                advertiseCallback = null
            }
            isRfcommListening = false
            try {
                rfcommServerSocket?.close()
                rfcommServerSocket = null
            } catch (e: Exception) {}
            outboundRfcommSockets.values.forEach {
                try { it.close() } catch (e: Exception) {}
            }
            outboundRfcommSockets.clear()
            try {
                gattServer?.close()
                gattServer = null
            } catch (e: Exception) {}
            isBroadcasting = false
            return true
        } catch (e: Exception) {
            return false
        }
    }

    @ReactMethod
    fun disconnectPeer(macOrId: String, promise: Promise) {
        try {
            val clean = macOrId.trim().uppercase()
            val socket = outboundRfcommSockets.remove(clean)
            try { socket?.close() } catch (e: Exception) {}

            val matchingKeys = outboundRfcommSockets.keys.filter {
                it.contains(clean) || clean.contains(it) || it.replace(":", "").contains(clean)
            }
            for (key in matchingKeys) {
                try { outboundRfcommSockets.remove(key)?.close() } catch (e: Exception) {}
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun showNotification(title: String, body: String, peerId: String) {
        try {
            val channelId = "radii_chat_messages"
            val notificationManager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    channelId,
                    "Radii Mesh Messages",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Incoming radio chat messages"
                    enableVibration(true)
                }
                notificationManager.createNotificationChannel(channel)
            }

            val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(reactContext.packageName)?.apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("peerId", peerId)
            }

            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val pendingIntent = PendingIntent.getActivity(reactContext, 0, launchIntent, flags)

            val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(reactContext, channelId)
            } else {
                @Suppress("DEPRECATION")
                Notification.Builder(reactContext)
            }

            val iconResId = reactContext.applicationInfo.icon
            val notification = builder
                .setSmallIcon(if (iconResId != 0) iconResId else android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) Notification.PRIORITY_HIGH else 0)
                .apply {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        setVibrate(longArrayOf(0, 250, 150, 250))
                    }
                }
                .build()

            notificationManager.notify(peerId.hashCode(), notification)
        } catch (e: Exception) {
            Log.w("RadiiRadio", "showNotification error", e)
        }
    }

    private var mediaRecorder: MediaRecorder? = null
    private var currentRecordingFile: String? = null
    private var mediaPlayer: MediaPlayer? = null

    @ReactMethod
    fun startAudioRecording(recordingId: String, promise: Promise) {
        try {
            val isAudioGranted = ContextCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED

            if (!isAudioGranted) {
                reactContext.currentActivity?.let { act: Activity ->
                    ActivityCompat.requestPermissions(
                        act,
                        arrayOf(Manifest.permission.RECORD_AUDIO),
                        201
                    )
                }
                promise.reject("PERMISSION_DENIED", "Microphone permission is required to record voice notes")
                return
            }

            val audioDir = File(reactContext.cacheDir, "voice_notes")
            if (!audioDir.exists()) audioDir.mkdirs()
            val outputFile = File(audioDir, "voice_${recordingId}.m4a")
            currentRecordingFile = outputFile.absolutePath

            mediaRecorder?.apply {
                try { stop() } catch (_: Exception) {}
                release()
            }
            mediaRecorder = (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(reactContext)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }).apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(64000)
                setAudioSamplingRate(44100)
                setOutputFile(outputFile.absolutePath)
                prepare()
                start()
            }
            promise.resolve(outputFile.absolutePath)
        } catch (e: Exception) {
            Log.e("RadiiRadio", "startAudioRecording error", e)
            promise.reject("RECORD_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopAudioRecording(promise: Promise) {
        try {
            mediaRecorder?.apply {
                try { stop() } catch (_: Exception) {}
                release()
            }
            mediaRecorder = null
            val path = currentRecordingFile
            val map = Arguments.createMap()
            map.putString("filePath", path ?: "")
            if (path != null && File(path).exists()) {
                val file = File(path)
                val bytes = file.readBytes()
                val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                map.putString("base64", base64)
                map.putInt("sizeBytes", bytes.size)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            Log.e("RadiiRadio", "stopAudioRecording error", e)
            promise.reject("RECORD_STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun playAudio(uriOrPath: String, promise: Promise) {
        try {
            mediaPlayer?.apply {
                try { stop() } catch (_: Exception) {}
                release()
            }
            mediaPlayer = MediaPlayer().apply {
                val clean = uriOrPath.removePrefix("file://")
                val localFile = File(clean)
                if (localFile.exists()) {
                    setDataSource(clean)
                } else if (uriOrPath.startsWith("http://") || uriOrPath.startsWith("https://") || uriOrPath.startsWith("content://") || uriOrPath.startsWith("file://")) {
                    setDataSource(reactContext, android.net.Uri.parse(uriOrPath))
                } else {
                    setDataSource(clean)
                }
                prepare()
                start()
                setOnCompletionListener {
                    val params = Arguments.createMap()
                    params.putString("event", "completed")
                    reactContext
                        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("onAudioPlaybackComplete", params)
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("RadiiRadio", "playAudio error", e)
            promise.reject("PLAY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun pauseAudio(promise: Promise) {
        try {
            mediaPlayer?.pause()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PAUSE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopAudio(promise: Promise) {
        try {
            mediaPlayer?.apply {
                try { stop() } catch (_: Exception) {}
                release()
            }
            mediaPlayer = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun readFileBase64(filePath: String, promise: Promise) {
        thread(start = true, isDaemon = true) {
            try {
                val cleanPath = filePath.replace("file://", "")
                val file = File(cleanPath)
                if (!file.exists()) {
                    promise.reject("NOT_FOUND", "File not found: $cleanPath")
                    return@thread
                }
                val bytes = file.readBytes()
                val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                val map = Arguments.createMap().apply {
                    putString("base64", base64)
                    putInt("sizeBytes", bytes.size)
                }
                promise.resolve(map)
            } catch (e: Exception) {
                Log.e("RadiiRadio", "readFileBase64 error", e)
                promise.reject("READ_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun saveMediaBase64(fileName: String, base64Data: String, mimeType: String, promise: Promise) {
        thread(start = true, isDaemon = true) {
            try {
                val cleanBase64 = if (base64Data.contains(",")) {
                    base64Data.substringAfter(",")
                } else {
                    base64Data
                }.replace("\n", "").replace("\r", "").trim()

                val bytes = android.util.Base64.decode(cleanBase64, android.util.Base64.DEFAULT)

                // 1. ALWAYS write immediately to internal cacheDir so the app gets an instantaneous, reliable file:// path
                val cacheDir = File(reactContext.cacheDir, "media").apply {
                    if (!exists()) mkdirs()
                }
                val localFile = File(cacheDir, fileName)
                localFile.writeBytes(bytes)
                val directLocalUri = "file://" + localFile.absolutePath

                // 2. Concurrently save a copy to public Downloads/Radii so user can find it in their phone's files
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val contentValues = ContentValues().apply {
                            put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                            put(MediaStore.MediaColumns.MIME_TYPE, mimeType.ifBlank { "application/octet-stream" })
                            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Radii")
                            put(MediaStore.MediaColumns.IS_PENDING, 1)
                        }
                        val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
                        val itemUri = reactContext.contentResolver.insert(collection, contentValues)
                        if (itemUri != null) {
                            reactContext.contentResolver.openOutputStream(itemUri)?.use { out ->
                                out.write(bytes)
                            }
                            contentValues.clear()
                            contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
                            reactContext.contentResolver.update(itemUri, contentValues, null, null)
                        }
                    } else {
                        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                        val radiiDir = File(downloadsDir, "Radii")
                        if (!radiiDir.exists()) radiiDir.mkdirs()
                        val publicFile = File(radiiDir, fileName)
                        publicFile.writeBytes(bytes)
                        try {
                            MediaScannerConnection.scanFile(
                                reactContext,
                                arrayOf(publicFile.absolutePath),
                                arrayOf(mimeType.ifBlank { "*/*" }),
                                null
                            )
                        } catch (_: Exception) {}
                    }
                } catch (e: Exception) {
                    Log.w("RadiiRadio", "Saving to public Downloads/Radii failed, internal copy preserved", e)
                }

                // Resolve with the local file:// URI that React Native Image and MediaPlayer can consume without restrictions
                promise.resolve(directLocalUri)
            } catch (e: Exception) {
                Log.e("RadiiRadio", "saveMediaBase64 error", e)
                promise.reject("SAVE_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun pickDocument(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("ACTIVITY_NULL", "Current activity is null")
            return
        }
        documentPickerPromise = promise
        try {
            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "*/*"
                addCategory(Intent.CATEGORY_OPENABLE)
            }
            activity.startActivityForResult(
                Intent.createChooser(intent, "Select file to share"),
                REQUEST_CODE_PICK_DOCUMENT
            )
        } catch (e: Exception) {
            documentPickerPromise = null
            promise.reject("PICK_ERROR", e.message)
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_CODE_PICK_DOCUMENT) {
            val promise = documentPickerPromise ?: return
            documentPickerPromise = null

            if (resultCode != android.app.Activity.RESULT_OK || data?.data == null) {
                promise.resolve(null)
                return
            }

            val uri: Uri = data.data ?: return
            thread(start = true, isDaemon = true) {
                try {
                    var displayName = "file_${System.currentTimeMillis()}"
                    var sizeBytes = 0

                    reactContext.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                        if (cursor.moveToFirst()) {
                            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                            if (nameIndex != -1) {
                                displayName = cursor.getString(nameIndex) ?: displayName
                            }
                            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                            if (sizeIndex != -1) {
                                sizeBytes = cursor.getInt(sizeIndex)
                            }
                        }
                    }

                    val mimeType = reactContext.contentResolver.getType(uri) ?: "application/octet-stream"
                    val inputStream = reactContext.contentResolver.openInputStream(uri)
                    val bytes = inputStream?.use { it.readBytes() } ?: ByteArray(0)
                    if (sizeBytes <= 0) sizeBytes = bytes.size
                    val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)

                    // Write to local cache so sender has an accessible file:// path
                    val cacheDir = File(reactContext.cacheDir, "media")
                    if (!cacheDir.exists()) cacheDir.mkdirs()
                    val localFile = File(cacheDir, displayName)
                    localFile.writeBytes(bytes)

                    val map = Arguments.createMap().apply {
                        putString("fileName", displayName)
                        putString("mimeType", mimeType)
                        putInt("sizeBytes", sizeBytes)
                        putString("base64", base64)
                        putString("uri", "file://" + localFile.absolutePath)
                    }
                    promise.resolve(map)
                } catch (e: Exception) {
                    Log.e("RadiiRadio", "read picked document error", e)
                    promise.reject("READ_DOCUMENT_ERROR", e.message)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {}

    @ReactMethod
    fun openFileWithIntent(filePathOrUri: String, mimeType: String, promise: Promise) {
        try {
            val cleanPath = filePathOrUri.removePrefix("file://")
            val file = File(cleanPath)
            val uri: Uri = if (file.exists()) {
                FileProvider.getUriForFile(
                    reactContext,
                    "${reactContext.packageName}.fileprovider",
                    file
                )
            } else {
                Uri.parse(filePathOrUri)
            }

            var targetMime = mimeType
            if (targetMime.isBlank() || targetMime == "application/octet-stream" || targetMime == "*/*") {
                val fileNameForExt = if (file.exists()) file.name else filePathOrUri.substringAfterLast("/")
                val ext = if (fileNameForExt.contains(".")) fileNameForExt.substringAfterLast(".").lowercase() else ""
                val mapped = if (ext.isNotBlank()) MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) else null
                targetMime = mapped ?: when (ext) {
                    "pdf" -> "application/pdf"
                    "apk" -> "application/vnd.android.package-archive"
                    "doc", "docx" -> "application/msword"
                    "xls", "xlsx" -> "application/vnd.ms-excel"
                    "ppt", "pptx" -> "application/vnd.ms-powerpoint"
                    "zip" -> "application/zip"
                    "txt" -> "text/plain"
                    "csv" -> "text/csv"
                    "m4a", "mp3", "wav", "aac" -> "audio/*"
                    "mp4", "mkv", "mov" -> "video/*"
                    "jpg", "jpeg", "png", "webp" -> "image/*"
                    else -> "*/*"
                }
            }

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, targetMime)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val chooser = Intent.createChooser(intent, "Open file with...").apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(chooser)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("RadiiRadio", "openFileWithIntent error", e)
            promise.reject("OPEN_ERROR", e.message)
        }
    }

    @ReactMethod
    fun openWifiSettings(promise: Promise) {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                Intent(Settings.Panel.ACTION_WIFI)
            } else {
                Intent(Settings.ACTION_WIFI_SETTINGS)
            }.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            try {
                val fallback = Intent(Settings.ACTION_WIFI_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(fallback)
                promise.resolve(true)
            } catch (err: Exception) {
                promise.reject("WIFI_SETTINGS_ERROR", err.message)
            }
        }
    }

    @ReactMethod
    fun checkPermissionsStatus(promise: Promise) {
        try {
            val isBluetoothOn = bluetoothAdapter?.isEnabled == true
            val wifiManager = reactContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            val isWifiOn = wifiManager?.isWifiEnabled == true

            val isLocationGranted = ContextCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

            val isAudioGranted = ContextCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED

            val isNotificationsGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    reactContext,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                NotificationManagerCompat.from(reactContext).areNotificationsEnabled()
            }

            val isNearbyGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(
                    reactContext,
                    Manifest.permission.NEARBY_WIFI_DEVICES
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }

            val isBluetoothScanGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                ContextCompat.checkSelfPermission(
                    reactContext,
                    Manifest.permission.BLUETOOTH_SCAN
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                true
            }

            val isStorageGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_MEDIA_AUDIO) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED
            } else {
                ContextCompat.checkSelfPermission(reactContext, Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(reactContext, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
            }

            val map = Arguments.createMap().apply {
                putBoolean("bluetooth", isBluetoothOn && isBluetoothScanGranted)
                putBoolean("bluetoothEnabled", isBluetoothOn)
                putBoolean("wifi", isWifiOn && isNearbyGranted)
                putBoolean("wifiEnabled", isWifiOn)
                putBoolean("location", isLocationGranted)
                putBoolean("audio", isAudioGranted)
                putBoolean("notifications", isNotificationsGranted)
                putBoolean("storage", isStorageGranted)
                val localIp = getLocalIpAddress()
                if (localIp != null) {
                    putString("localIp", localIp)
                }
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("PERM_ERROR", e.message)
        }
    }

    private fun getLocalIpAddress(): String? {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val netIf = interfaces.nextElement()
                if (netIf.isLoopback || !netIf.isUp) continue
                val addrs = netIf.inetAddresses
                while (addrs.hasMoreElements()) {
                    val addr = addrs.nextElement()
                    if (!addr.isLoopbackAddress && addr is Inet4Address) {
                        val host = addr.hostAddress
                        if (!host.isNullOrEmpty() && !host.startsWith("127.")) {
                            return host
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("RadiiRadio", "Error finding local IP", e)
        }
        return null
    }

    @ReactMethod
    fun getLocalIpAddress(promise: Promise) {
        promise.resolve(getLocalIpAddress())
    }

    @ReactMethod
    fun requestAudioPermission(promise: Promise) {
        try {
            val isGranted = ContextCompat.checkSelfPermission(
                reactContext,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED

            if (isGranted) {
                promise.resolve(true)
                return
            }

            val activity = reactContext.currentActivity
            if (activity != null) {
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(Manifest.permission.RECORD_AUDIO),
                    201
                )
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("AUDIO_PERM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun requestNotificationPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val isGranted = ContextCompat.checkSelfPermission(
                    reactContext,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
                if (isGranted) {
                    promise.resolve(true)
                    return
                }

                val activity = reactContext.currentActivity
                if (activity != null) {
                    ActivityCompat.requestPermissions(
                        activity,
                        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                        202
                    )
                    promise.resolve(true)
                    return
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("NOTIF_PERM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun requestStoragePermission(promise: Promise) {
        try {
            val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                arrayOf(
                    Manifest.permission.READ_MEDIA_IMAGES,
                    Manifest.permission.READ_MEDIA_VIDEO,
                    Manifest.permission.READ_MEDIA_AUDIO
                )
            } else {
                arrayOf(
                    Manifest.permission.READ_EXTERNAL_STORAGE,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE
                )
            }

            val allGranted = permissions.all {
                ContextCompat.checkSelfPermission(reactContext, it) == PackageManager.PERMISSION_GRANTED
            }

            if (allGranted) {
                promise.resolve(true)
                return
            }

            val activity = reactContext.currentActivity
            if (activity != null) {
                ActivityCompat.requestPermissions(activity, permissions, 203)
                promise.resolve(true)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("STORAGE_PERM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun openAppSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", reactContext.packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("APP_SETTINGS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
