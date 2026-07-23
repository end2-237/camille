import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, Image } from "react-native";
import { C } from "../theme";

export default function Splash() {
  const scale = useRef(new Animated.Value(0.8)).current;
  const op = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [scale, op, pulse]);

  const ring = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const ringOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: 120, height: 120, borderRadius: 34, backgroundColor: C.lime, opacity: ringOp, transform: [{ scale: ring }] }} />
      <Animated.View style={{ opacity: op, transform: [{ scale }], alignItems: "center" }}>
        <Image source={require("../../assets/icon.png")} style={{ width: 96, height: 96, borderRadius: 26 }} />
        <Text style={{ marginTop: 18, fontSize: 26, fontWeight: "800", color: C.ink, letterSpacing: -0.5 }}>Camille</Text>
        <Text style={{ marginTop: 6, fontSize: 13, color: C.sub }}>Suivi de vos agents IA</Text>
      </Animated.View>
    </View>
  );
}
