import React, { useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View, Image, ImageProps, ImageStyle, StyleProp, Dimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/build/Ionicons';
import { useVideoPlayer, VideoView } from 'expo-video';

type FullscreenMediaModalProps = {
  visible: boolean;
  onClose: () => void;
  type: 'image' | 'video';
  uri: string;
};

/** Imagen con pinch-to-zoom + pan; doble tap restaura el zoom. */
function ZoomableFullscreenImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetZoom = () => {
    'worklet';
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(1, Math.min(savedScale.value * event.scale, 6));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        resetZoom();
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (savedScale.value <= 1) return;
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        resetZoom();
      } else {
        scale.value = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture, panGesture),
    pinchGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const { width, height } = Dimensions.get('window');

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.zoomContainer, animatedStyle]}>
        <Image
          source={{ uri }}
          style={{ width, height: height * 0.9 }}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * El reproductor solo se crea (y solo empieza a sonar/reproducir) mientras este componente está
 * montado. Montarlo únicamente cuando el modal está visible evita que el video se reproduzca de
 * fondo antes de abrir la pantalla completa, y lo detiene automáticamente al cerrarla (desmontaje).
 */
function FullscreenVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.fullscreenVideo}
      contentFit="contain"
      nativeControls
      allowsFullscreen
      allowsPictureInPicture={false}
    />
  );
}

/** Modal de pantalla completa reutilizable para imágenes (con zoom) y videos. */
export function FullscreenMediaModal({ visible, onClose, type, uri }: FullscreenMediaModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* RNGH no detecta gestos dentro de un <Modal> si no se declara su propio root aquí (limitación conocida en Android). */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={16}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {visible && type === 'image' && <ZoomableFullscreenImage uri={uri} />}
          {visible && type === 'video' && <FullscreenVideoPlayer uri={uri} />}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Envuelve una <Image> de lista/miniatura para que se pueda abrir en pantalla completa con zoom. */
export function ZoomableThumbnailImage({
  uri,
  style,
  ...imageProps
}: { uri: string; style?: StyleProp<ImageStyle> } & Omit<ImageProps, 'source' | 'style'>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setIsFullscreen(true)}>
        <Image source={{ uri }} style={style} {...imageProps} />
      </TouchableOpacity>
      <FullscreenMediaModal visible={isFullscreen} onClose={() => setIsFullscreen(false)} type="image" uri={uri} />
    </>
  );
}

/** Botón de expandir para superponer sobre un reproductor de video ya existente en una lista. */
export function FullscreenVideoButton({ uri, style }: { uri: string; style?: StyleProp<ImageStyle> }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  return (
    <>
      <TouchableOpacity style={[styles.expandButton, style]} onPress={() => setIsFullscreen(true)} hitSlop={8}>
        <Ionicons name="expand" size={18} color="#fff" />
      </TouchableOpacity>
      <FullscreenMediaModal visible={isFullscreen} onClose={() => setIsFullscreen(false)} type="video" uri={uri} />
    </>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 6,
  },
  zoomContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenVideo: {
    width: '100%',
    height: '70%',
  },
  expandButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    padding: 6,
    zIndex: 5,
  },
});
