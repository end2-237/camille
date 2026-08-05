import React, { useEffect, useRef, useMemo } from "react";
import { View, Modal, Animated, TouchableWithoutFeedback, Dimensions, Easing, PanResponder } from "react-native";
import { C, SH } from "../theme";

const { width, height } = Dimensions.get("window");

const ABSOLU = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Feuille qui monte du bas.
 *
 * Elle s'ouvrait sur une courbe de durée et ne se fermait qu'au bouton. Or le
 * geste attendu sur un panneau de ce genre, c'est de le repousser vers le bas
 * avec le pouce — c'est même souvent le seul essayé. On l'ajoute, mais
 * uniquement depuis la poignée : si on écoutait le glissement partout, on
 * volerait le geste aux listes qui défilent à l'intérieur.
 *
 * Le relâchement décide sur DEUX critères : la distance parcourue, et la
 * vitesse. Un coup de pouce sec et court doit fermer — n'écouter que la
 * distance obligerait à traîner la feuille jusqu'en bas.
 */
export function BottomDrawer({ visible, onClose, children, heightPct = 0.88 }) {
  const H = height * heightPct;
  const y = useRef(new Animated.Value(height)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        // Ressort plutôt que durée : la feuille arrive avec un poids.
        Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 12, tension: 80 }),
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      y.setValue(height); fade.setValue(0);
    }
  }, [visible, y, fade]);

  function close() {
    Animated.parallel([
      Animated.timing(y, { toValue: height, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(onClose);
  }

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          // Vers le haut, on ne suit pas : la feuille est déjà en butée.
          if (g.dy > 0) y.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > H * 0.28 || g.vy > 0.8) {
            Animated.parallel([
              Animated.timing(y, { toValue: height, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
              Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
            ]).start(onClose);
          } else {
            Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 9, tension: 110 }).start();
          }
        },
      }),
    [y, fade, H, onClose]
  );

  // Le voile s'assombrit avec la feuille : quand on la repousse, le fond
  // revient. Sans ça, une feuille à moitié baissée reste sur un écran noir et
  // le geste paraît sans effet.
  const voile = Animated.multiply(
    fade,
    y.interpolate({ inputRange: [0, H], outputRange: [1, 0.15], extrapolate: "clamp" })
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={close}>
          <Animated.View style={{ ...ABSOLU, backgroundColor: "rgba(6,6,12,0.5)", opacity: voile }} />
        </TouchableWithoutFeedback>

        <Animated.View style={[{
          position: "absolute", left: 0, right: 0, bottom: 0, height: H,
          backgroundColor: C.bg, borderTopLeftRadius: 30, borderTopRightRadius: 30,
          transform: [{ translateY: y }], overflow: "hidden",
        }, SH.float]}>
          {/* Zone de préhension. Généreuse : 26 points de haut se ratent au
              pouce, on descend la surface sensible à 40. */}
          <View {...pan.panHandlers} style={{ alignItems: "center", paddingTop: 11, paddingBottom: 8 }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.16)" }} />
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
        Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 12, tension: 80 }),
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
          <Animated.View style={{ ...ABSOLU, backgroundColor: "rgba(6,6,12,0.5)", opacity: fade }} />
        </TouchableWithoutFeedback>
        <Animated.View style={[{
          position: "absolute", left: 0, top: 0, bottom: 0, width: W,
          backgroundColor: C.bg, borderTopRightRadius: 30, borderBottomRightRadius: 30,
          transform: [{ translateX: x }], overflow: "hidden",
        }, SH.float]}>
          {children({ close })}
        </Animated.View>
      </View>
    </Modal>
  );
}
