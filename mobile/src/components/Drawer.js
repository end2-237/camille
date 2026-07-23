import React, { useEffect, useRef } from "react";
import { View, Modal, Animated, TouchableWithoutFeedback, Dimensions, Easing } from "react-native";
import { C, R } from "../theme";

const { width, height } = Dimensions.get("window");

// Drawer qui monte du bas (bottom sheet), ~88% de hauteur.
export function BottomDrawer({ visible, onClose, children, heightPct = 0.88 }) {
  const y = useRef(new Animated.Value(height)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      y.setValue(height); fade.setValue(0);
    }
  }, [visible, y, fade]);

  function close() {
    Animated.parallel([
      Animated.timing(y, { toValue: height, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(onClose);
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={close}>
          <Animated.View style={{ ...StyleSheetAbsolute, backgroundColor: "rgba(0,0,0,0.45)", opacity: fade }} />
        </TouchableWithoutFeedback>
        <Animated.View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * heightPct,
          backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, transform: [{ translateY: y }], overflow: "hidden" }}>
          <View style={{ alignItems: "center", paddingTop: 10 }}>
            <View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.15)" }} />
          </View>
          {children({ close })}
        </Animated.View>
      </View>
    </Modal>
  );
}

// Drawer qui vient de la gauche, quasi plein écran (92% largeur).
export function LeftDrawer({ visible, onClose, children, widthPct = 0.94 }) {
  const W = width * widthPct;
  const x = useRef(new Animated.Value(-W)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(x, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      x.setValue(-W); fade.setValue(0);
    }
  }, [visible, x, fade, W]);

  function close() {
    Animated.parallel([
      Animated.timing(x, { toValue: -W, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(onClose);
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={close}>
          <Animated.View style={{ ...StyleSheetAbsolute, backgroundColor: "rgba(0,0,0,0.45)", opacity: fade }} />
        </TouchableWithoutFeedback>
        <Animated.View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: W,
          backgroundColor: C.bg, borderTopRightRadius: 26, borderBottomRightRadius: 26, transform: [{ translateX: x }], overflow: "hidden" }}>
          {children({ close })}
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleSheetAbsolute = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };
