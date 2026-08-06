// ─────────────────────────────────────────────────────────────────────────────
// Mouvement.
//
// Une règle unique gouverne ce fichier : tout ce qui bouge bouge sur le thread
// UI. Concrètement, on n'anime que `transform` et `opacity`, et toujours avec
// `useNativeDriver: true`. C'est ce qui fait qu'une carte continue de répondre
// au doigt pendant que l'écran charge trente commandes — l'animation ne passe
// pas par JavaScript, donc un chargement ne peut pas la faire saccader.
//
// Animer une couleur, une hauteur ou une largeur repasserait par le pont à
// chaque image : c'est exactement ce qui donne l'impression de « web dans une
// app ». On s'en interdit l'usage.
//
// Pas de react-native-reanimated : ce serait un module natif de plus, donc un
// nouveau build APK pour tout le monde. Animated suffit ici, et part par OTA.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useCallback } from "react";
import { Animated, Pressable, Easing, View } from "react-native";

// Ressorts. iOS ne fait pas de « durée » : il fait de la masse et du frottement.
export const SPRING = { useNativeDriver: true, friction: 9, tension: 110 };
export const SPRING_DOUX = { useNativeDriver: true, friction: 12, tension: 70 };

/**
 * Zone tapable qui s'enfonce.
 *
 * Le doigt appuie, l'objet recule : sans ce retour, un écran ne dit jamais
 * qu'il a entendu le geste, et l'utilisateur tape deux fois. 0.965 est assez
 * pour être senti, assez peu pour ne pas faire jouet.
 */
export function Press({ children, onPress, style, scale = 0.965, disabled, hitSlop, ...rest }) {
  const a = useRef(new Animated.Value(1)).current;

  const enfonce = useCallback(() => {
    Animated.spring(a, { toValue: scale, useNativeDriver: true, friction: 8, tension: 240 }).start();
  }, [a, scale]);

  const relache = useCallback(() => {
    Animated.spring(a, { toValue: 1, useNativeDriver: true, friction: 5, tension: 180 }).start();
  }, [a]);

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={disabled ? undefined : enfonce}
      onPressOut={disabled ? undefined : relache}
      hitSlop={hitSlop}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale: a }], opacity: disabled ? 0.55 : 1 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Apparition en cascade.
 *
 * Chaque élément monte de quelques points en s'opacifiant, décalé de `index`
 * fois `pas` millisecondes. Le décalage compte plus que l'animation elle-même :
 * il fait lire la liste de haut en bas au lieu de la faire surgir d'un bloc.
 */
export function Reveal({ children, index = 0, pas = 55, dy = 16, style, duree = 420 }) {
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = Animated.timing(a, {
      toValue: 1,
      duration: duree,
      delay: Math.min(index * pas, 500), // au-delà d'une demi-seconde, ça se voit
      easing: Easing.bezier(0.22, 1, 0.36, 1), // sortie franche, arrivée posée
      useNativeDriver: true,
    });
    t.start();
    return () => t.stop();
  }, [a, index, pas, duree]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: a,
          transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Photo qui respire quand on tire l'écran vers le bas.
 *
 * On rend le style à appliquer à l'image ; le parent garde la main sur le
 * `ScrollView`. En haut de course l'image grandit et suit le doigt : c'est le
 * geste qui, sur iOS, dit qu'on est arrivé au bout — l'écran devient élastique
 * au lieu de buter.
 */
export function styleParallaxe(scrollY, hauteur) {
  return {
    transform: [
      {
        translateY: scrollY.interpolate({
          inputRange: [-hauteur, 0, hauteur],
          outputRange: [-hauteur / 2, 0, hauteur * 0.32], // suit, puis se laisse distancer
          extrapolateRight: "clamp",
        }),
      },
      {
        scale: scrollY.interpolate({
          inputRange: [-hauteur, 0],
          outputRange: [1.9, 1],
          extrapolateRight: "clamp",
        }),
      },
    ],
  };
}

/**
 * Halo qui pulse, pour un élément qui attend une action.
 *
 * Boucle infinie mais purement native : elle ne réveille pas JavaScript une
 * seule fois après son démarrage, et ne coûte donc rien au reste de l'écran.
 */
export function Halo({ size = 76, color = "rgba(198,242,78,0.34)", radius = 999 }) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [p]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size, height: size, borderRadius: radius, backgroundColor: color,
        opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.65] }) }],
      }}
    />
  );
}

/**
 * Barre de progression qui se remplit.
 *
 * Animer `width` repasserait par le pont à chaque image. On peint donc la barre
 * à sa largeur PLEINE et on la met à l'échelle horizontalement.
 *
 * Piège : `scaleX` s'applique depuis le CENTRE, et `transformOrigin` n'existe
 * pas en React Native 0.74. Une jauge à 50 % se réduirait donc joliment... par
 * les deux bouts à la fois. On rattrape l'origine à la main : quand l'échelle
 * vaut s, le bord gauche s'est décalé de W(1−s)/2, on le ramène. Les deux
 * transformations sortent de la même valeur animée, donc restent synchrones.
 */
export function Jauge({ pct = 0, couleur, hauteur = 8, fond = "rgba(255,255,255,0.12)", radius = 4 }) {
  const a = useRef(new Animated.Value(0)).current;
  const [W, setW] = React.useState(0);

  useEffect(() => {
    Animated.timing(a, {
      toValue: Math.max(0, Math.min(100, pct)) / 100,
      duration: 900,
      delay: 150,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start();
  }, [a, pct]);

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: hauteur, borderRadius: radius, backgroundColor: fond, overflow: "hidden" }}
    >
      <Animated.View
        style={{
          height: hauteur, borderRadius: radius, backgroundColor: couleur, width: "100%",
          transform: [
            { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-W / 2, 0] }) },
            { scaleX: a },
          ],
        }}
      />
    </View>
  );
}
