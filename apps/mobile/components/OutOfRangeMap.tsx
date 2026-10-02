import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { ThemedView } from './ThemedView';

type LatLng = { lat: number; lng: number };

type OutOfRangeMapProps = {
  /** Ubicación del dispositivo (actual si está disponible; si no, la última guardada). */
  deviceLat?: number | null;
  deviceLng?: number | null;
  /** Ubicación del puesto usada por la pantalla para la validación de los 50 m. */
  puestoLat?: number | null;
  puestoLng?: number | null;
};

type PointsPayload = { device: LatLng | null; puesto: LatLng | null };

function toValidPoint(lat: number | null | undefined, lng: number | null | undefined): LatLng | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Página HTML mínima y estática (no lleva coordenadas incrustadas): Leaflet + tiles ráster
 * públicos de OpenStreetMap (https://tile.openstreetmap.org/{z}/{x}/{y}.png), con atribución
 * "© OpenStreetMap contributors". Sin rutas, geocodificación ni buscador — solo visualización.
 * Las coordenadas del dispositivo/puesto se reciben después, vía `postMessage` desde React Native
 * (ver `sendPoints`/`handleMessage` más abajo), así el HTML nunca se reconstruye al cambiar los
 * puntos y el WebView no se recrea innecesariamente.
 */
const LEAFLET_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #E8F4FF; }
  .marker-dot { width: 18px; height: 18px; border-radius: 9px; border: 2px solid #FFFFFF; box-shadow: 0 0 3px rgba(0,0,0,0.45); }
  .marker-dot.device { background: #007AFF; }
  .marker-dot.puesto { background: #FF3B30; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { attributionControl: true, zoomControl: true }).setView([0, 0], 2);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  var deviceIcon = L.divIcon({ className: '', html: '<div class="marker-dot device"></div>', iconSize: [18, 18] });
  var puestoIcon = L.divIcon({ className: '', html: '<div class="marker-dot puesto"></div>', iconSize: [18, 18] });
  var deviceMarker = null;
  var puestoMarker = null;

  function applyPoints(data) {
    var bounds = [];
    if (data && data.device) {
      var d = [data.device.lat, data.device.lng];
      if (deviceMarker) { deviceMarker.setLatLng(d); } else { deviceMarker = L.marker(d, { icon: deviceIcon }).addTo(map); }
      bounds.push(d);
    } else if (deviceMarker) {
      map.removeLayer(deviceMarker);
      deviceMarker = null;
    }
    if (data && data.puesto) {
      var p = [data.puesto.lat, data.puesto.lng];
      if (puestoMarker) { puestoMarker.setLatLng(p); } else { puestoMarker = L.marker(p, { icon: puestoIcon }).addTo(map); }
      bounds.push(p);
    } else if (puestoMarker) {
      map.removeLayer(puestoMarker);
      puestoMarker = null;
    }
    if (bounds.length === 2) {
      map.fitBounds(bounds, { padding: [32, 32] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    }
  }

  function handleRNMessage(event) {
    try {
      applyPoints(JSON.parse(event.data));
    } catch (err) {}
  }
  document.addEventListener('message', handleRNMessage);
  window.addEventListener('message', handleRNMessage);

  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  }
</script>
</body>
</html>`;

/**
 * Mapa cuadrado de bordes redondeados usado cuando el usuario está fuera del radio de 50 m del
 * puesto. Marcador azul = ubicación del dispositivo; marcador rojo = ubicación del puesto.
 * Implementado con `react-native-webview` + Leaflet + tiles OpenStreetMap (ver `LEAFLET_HTML`).
 * Seguro ante coordenadas faltantes: muestra lo que haya disponible (uno, otro, ambos o ninguno)
 * sin lanzar errores.
 */
export default function OutOfRangeMap({ deviceLat, deviceLng, puestoLat, puestoLng }: OutOfRangeMapProps) {
  const webviewRef = useRef<WebView>(null);
  const [isReady, setIsReady] = useState(false);

  const points = useMemo<PointsPayload>(
    () => ({
      device: toValidPoint(deviceLat, deviceLng),
      puesto: toValidPoint(puestoLat, puestoLng),
    }),
    [deviceLat, deviceLng, puestoLat, puestoLng],
  );

  const sendPoints = useCallback((payload: PointsPayload) => {
    webviewRef.current?.postMessage(JSON.stringify(payload));
  }, []);

  // El HTML es estático (no incluye coordenadas), así que solo se reenvían los puntos por
  // `postMessage` cuando cambian — el WebView nunca se recrea/recarga por esto.
  useEffect(() => {
    if (isReady) sendPoints(points);
  }, [isReady, points, sendPoints]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data?.type === 'ready') {
          setIsReady(true);
          sendPoints(points);
        }
      } catch {
        // Mensaje no relevante: se ignora sin afectar el mapa.
      }
    },
    [points, sendPoints],
  );

  return (
    <ThemedView style={styles.container}>
      <WebView
        ref={webviewRef}
        source={{ html: LEAFLET_HTML }}
        style={styles.webview}
        originWhitelist={['*']}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        bounces={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#B8DAF8',
    backgroundColor: '#E8F4FF',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
