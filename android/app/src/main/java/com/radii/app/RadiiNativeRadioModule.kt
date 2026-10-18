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
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
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
import java.util.*
import kotlin.concurrent.thread

@SuppressLint("MissingPermission")
class RadiiNativeRadioModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

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

            val lm = reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            val isGpsOn = lm?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true ||
                    lm?.isProviderEnabled(LocationManager.NETWORK_PROVIDER) == true

            if (!isGpsOn) {
                Log.w("RadiiRadio", "WARNING: Android Master Location toggle is OFF! Android will suppress BLE scan results.")
            }

            val result = Arguments.createMap()
            result.putBoolean("bluetoothEnabled", adapter?.isEnabled == true)
            result.putBoolean("bluetoothPrompted", bluetoothPrompted)
            result.putBoolean("locationEnabled", isGpsOn)
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

                    // Build strictly <= 31-byte legacy BLE Manufacturer Data packet:
                    // Flags: 3 bytes
                    // Manufacturer Header: 4 bytes (len + 0xFF + 2-byte Company ID 0x11FD)
                    // Payload: 1 byte (version) + 6 bytes (shortId) + up to 12 bytes (name) = 19 bytes
                    // Total Primary Packet = 3 + 4 + 19 = 26 bytes (guaranteed <= 31 bytes!)
                    val shortId = peerId.takeLast(6).lowercase()
                    val shortIdBytes = shortId.toByteArray(Charsets.UTF_8)

                    val safeName = (if (displayName.isNotBlank()) displayName.trim() else "Radii User")
                    val rawNameBytes = safeName.toByteArray(Charsets.UTF_8)
                    val maxNameBytes = 12
                    val nameBytes = if (rawNameBytes.size > maxNameBytes) {
                        rawNameBytes.copyOfRange(0, maxNameBytes)
                    } else {
                        rawNameBytes
                    }

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
                        .build()

                    // Scan Response: Include Service UUID for backwards compatibility (18 bytes <= 31 bytes!)
                    val scanResponseData = AdvertiseData.Builder()
                        .setIncludeDeviceName(false)
                        .setIncludeTxPowerLevel(false)
                        .addServiceUuid(SERVICE_PARCEL_UUID)
                        .build()

                    val callback = object : AdvertiseCallback() {
                        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                            super.onStartSuccess(settingsInEffect)
                            Log.d("RadiiRadio", "Radii BLE Advertiser active (mfgPayload=${mfgPayload.size}b, shortId=$shortId, name=$safeName)")
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
                        settingsBuilder.setNumOfMatches(ScanSettings.MATCH_NUM_ONE_ADVERTISEMENT)
                        settingsBuilder.setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
                    }
                    val settings = settingsBuilder.build()

                    // Open hardware filter bypass: many OEM chipsets (Qualcomm, MediaTek, Exynos)
                    // drop BLE packets in hardware filters. Using an open filter guarantees reception.
                    val openFilter = ScanFilter.Builder().build()

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
                    bleScanner?.startScan(listOf(openFilter), settings, callback)
                    Log.d("RadiiRadio", "Radii BLE Scanner active (Zero-drop hardware bypass)")
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

            // If a specific target is set and does not match our device, discard
            if (targetShortId.isNotEmpty() && myShortId.isNotEmpty() && targetShortId != myShortId) {
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

    private fun handleIncomingRfcommSocket(socket: BluetoothSocket) {
        thread(start = true, isDaemon = true) {
            try {
                val input = socket.inputStream
                val buffer = ByteArray(4096)
                while (true) {
                    val bytesRead = input.read(buffer)
                    if (bytesRead <= 0) break
                    val rawText = String(buffer, 0, bytesRead, Charsets.UTF_8)
                    dispatchIncomingMessage(rawText, "ble")
                }
            } catch (e: Exception) {
                // Connection ended
            } finally {
                try { socket.close() } catch (e: Exception) {}
            }
        }
    }

    @ReactMethod
    fun sendBluetoothMessage(macAddress: String, messageJson: String, promise: Promise) {
        thread(start = true, isDaemon = true) {
            var socket: BluetoothSocket? = null
            try {
                val adapter = refreshBluetoothAdapter() ?: throw Exception("Bluetooth adapter not available")
                val device = adapter.getRemoteDevice(macAddress)
                socket = device.createInsecureRfcommSocketToServiceRecord(SERVICE_UUID)
                socket.connect()
                socket.outputStream.write(messageJson.toByteArray(Charsets.UTF_8))
                socket.outputStream.flush()
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e("RadiiRadio", "sendBluetoothMessage failed: ${e.message}")
                promise.resolve(false)
            } finally {
                try { socket?.close() } catch (e: Exception) {}
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
                    val json = JSONObject().apply {
                        put("type", "RADII_BEACON")
                        put("id", peerId)
                        put("name", name)
                        put("platform", "android")
                        put("device", Build.MODEL ?: "Android")
                        put("timestamp", System.currentTimeMillis())
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
                val buffer = ByteArray(4096)
                Log.d("RadiiRadio", "UDP Mesh listener active on port $UDP_PORT (reuseAddress=true)")

                while (isListening) {
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
                }
            } catch (e: Exception) {
                // Socket stopped
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
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
