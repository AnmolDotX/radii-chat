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
import android.content.Context
import android.content.Intent
import android.location.LocationManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.ParcelUuid
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.NetworkInterface
import java.util.*
import kotlin.concurrent.thread

@SuppressLint("MissingPermission")
class RadiiNativeRadioModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "RadiiNativeRadio"

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

    init {
        try {
            val bm = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            bluetoothAdapter = bm?.adapter
        } catch (e: Exception) {
            e.printStackTrace()
        }
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
            val bm = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bm?.adapter ?: bluetoothAdapter

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
    fun startAdvertising(peerId: String, displayName: String, promise: Promise) {
        try {
            currentPeerId = peerId
            currentDisplayName = displayName

            val bm = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bm?.adapter ?: bluetoothAdapter

            if (adapter != null && adapter.isEnabled) {
                bleAdvertiser = adapter.bluetoothLeAdvertiser
                if (bleAdvertiser != null && advertiseCallback == null) {
                    val settings = AdvertiseSettings.Builder()
                        .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                        .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                        .setConnectable(true)
                        .setTimeout(0)
                        .build()

                    // Primary 31-byte packet: Service UUID + 6-byte shortId
                    val shortId = peerId.takeLast(6)
                    val cleanShortId = shortId.toByteArray(Charsets.UTF_8)
                    val primaryData = AdvertiseData.Builder()
                        .setIncludeDeviceName(false)
                        .setIncludeTxPowerLevel(false)
                        .addServiceUuid(SERVICE_PARCEL_UUID)
                        .addServiceData(SERVICE_PARCEL_UUID, cleanShortId)
                        .build()

                    // Scan Response: Use NAME_PARCEL_UUID for display name (avoids Map key collision & OS adapter renaming)
                    val safeName = (if (displayName.isNotBlank()) displayName.trim() else "Radii User").take(18)
                    val nameBytes = safeName.toByteArray(Charsets.UTF_8)
                    val scanResponseData = AdvertiseData.Builder()
                        .setIncludeDeviceName(false)
                        .setIncludeTxPowerLevel(false)
                        .addServiceUuid(NAME_PARCEL_UUID)
                        .addServiceData(NAME_PARCEL_UUID, nameBytes)
                        .build()

                    val callback = object : AdvertiseCallback() {
                        override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                            super.onStartSuccess(settingsInEffect)
                            Log.d("RadiiRadio", "Radii BLE Advertiser started with shortId: $shortId, name: $safeName")
                        }

                        override fun onStartFailure(errorCode: Int) {
                            super.onStartFailure(errorCode)
                            Log.e("RadiiRadio", "Radii BLE Advertiser failed: $errorCode")
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

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("RadiiRadio", "startAdvertising error", e)
            promise.resolve(false)
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
        try {
            val bm = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            val adapter = bm?.adapter ?: bluetoothAdapter

            if (adapter != null && adapter.isEnabled) {
                bleScanner = adapter.bluetoothLeScanner
                if (bleScanner != null && scanCallback == null) {
                    val settingsBuilder = ScanSettings.Builder()
                        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                        .setReportDelay(0)

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        settingsBuilder.setMatchMode(ScanSettings.MATCH_MODE_AGGRESSIVE)
                        settingsBuilder.setNumOfMatches(ScanSettings.MATCH_NUM_ONE_ADVERTISEMENT)
                        settingsBuilder.setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
                    }
                    val settings = settingsBuilder.build()

                    // HARDWARE FILTER: Only receive advertisements containing Radii UUID 0xFD11
                    // This is more reliable than null-filter + software check, and more battery efficient.
                    val scanFilter = ScanFilter.Builder()
                        .setServiceUuid(SERVICE_PARCEL_UUID)
                        .build()

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
                    bleScanner?.startScan(listOf(scanFilter), settings, callback)
                    Log.d("RadiiRadio", "Radii BLE Scanner active (Hardware UUID filter: 0xFD11)")
                }
            }

            // Start UDP listener on local Wi-Fi / Hotspot
            startUdpListener()

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("RadiiRadio", "startScanning error", e)
            promise.resolve(false)
        }
    }

    private fun handleBleScanResult(result: ScanResult) {
        try {
            val device = result.device ?: return
            val record = result.scanRecord ?: return

            // Extract the shortId from service data 0xFD11
            val serviceDataBytes = record.serviceData[SERVICE_PARCEL_UUID]
            val remoteShortId = if (serviceDataBytes != null && serviceDataBytes.isNotEmpty()) {
                String(serviceDataBytes, Charsets.UTF_8).trim()
            } else {
                ""
            }

            // STRICT FILTER: Discard own device loopback
            val myShortId = currentPeerId.takeLast(6)
            if (remoteShortId.isNotEmpty() && myShortId.isNotEmpty() && remoteShortId.equals(myShortId, ignoreCase = true)) {
                return // Loopback of own broadcast
            }

            val rssi = result.rssi
            val distanceBracket = calculateDistanceBracket(rssi)
            val shortId = if (remoteShortId.isNotEmpty()) remoteShortId else device.address.replace(":", "").takeLast(6).lowercase()
            val stableId = "peer_$shortId"

            // Read display name from 0xFD12 service data (or fall back to shortId)
            val nameBytes = record.serviceData[NAME_PARCEL_UUID]
            val peerName = if (nameBytes != null && nameBytes.isNotEmpty()) {
                String(nameBytes, Charsets.UTF_8).trim().ifEmpty { "Radii User" }
            } else if (remoteShortId.isNotEmpty()) {
                "Radii·${remoteShortId}"
            } else {
                "Nearby Radii Companion"
            }

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
                val adapter = bluetoothAdapter ?: return@thread
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
                val adapter = bluetoothAdapter ?: throw Exception("Bluetooth adapter not available")
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
                val adapter = bluetoothAdapter ?: return@thread promise.resolve(false)
                val device = adapter.getRemoteDevice(macAddress)
                val bytes = messageJson.toByteArray(Charsets.UTF_8)
                var resolved = false

                val gattCallback = object : BluetoothGattCallback() {
                    override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
                        if (newState == BluetoothGatt.STATE_CONNECTED) {
                            gatt?.discoverServices()
                        } else if (newState == BluetoothGatt.STATE_DISCONNECTED) {
                            gatt?.close()
                            if (!resolved) {
                                resolved = true
                                promise.resolve(false)
                            }
                        }
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
                                gatt.disconnect()
                                return
                            }
                        }
                        gatt?.disconnect()
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
                udpSocket = DatagramSocket(UDP_PORT)
                udpSocket?.broadcast = true
                val buffer = ByteArray(4096)

                while (isListening) {
                    val packet = DatagramPacket(buffer, buffer.size)
                    udpSocket?.receive(packet)

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
        try {
            scanCallback?.let {
                bleScanner?.stopScan(it)
                scanCallback = null
            }
            isListening = false
            udpSocket?.close()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun stopAdvertising(promise: Promise) {
        try {
            advertiseCallback?.let {
                bleAdvertiser?.stopAdvertising(it)
                advertiseCallback = null
            }
            isRfcommListening = false
            try {
                rfcommServerSocket?.close()
            } catch (e: Exception) {}
            try {
                gattServer?.close()
                gattServer = null
            } catch (e: Exception) {}
            isBroadcasting = false
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
