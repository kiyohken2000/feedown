import { Circle } from "@shopify/react-native-skia";
import React, { useEffect, useRef } from "react";
import {
  interpolateColor,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";

const BlurCircleColors = [
  "#D6D9FA",
  "#D6F9EE",
  "#FFF0DC",
  "lavender",
  "aliceblue",
  "lightyellow"
];

const BlurCircle = ({ delay = 0, ...props }) => {
  /** Randomly mixed colors */
  const colors = useRef(
    [...BlurCircleColors].sort(() => Math.random() - 0.5)
  ).current;
  /** Time to animate all colors */
  const colorAnimationDuration = useRef(colors.length * 1500).current;
  /** Parameter responsible for color animation */
  const color = useSharedValue(0);

  /** Parameter responsible for radius animation */
  const radius = useSharedValue(props.r);

  /** Radius of the animated circle */
  const radiusAnimationSize = useRef(props.r + props.r * 0.3).current;

  const animatedColor = useDerivedValue(() =>
    interpolateColor(
      color.value,
      colors.map((_, index) => index / (colors.length - 1)),
      [...colors]
    )
  );

  useEffect(() => {
    // Change radius after delay and and loop it
    radius.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(radiusAnimationSize, { duration: 2500 }),
          withTiming(props.r, { duration: 2500 })
        ),
        -1
      )
    );
    // Change color after delay and and loop it
    color.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: colorAnimationDuration }),
          withTiming(0, { duration: colorAnimationDuration })
        ),
        -1
      )
    );
  }, [props.r, delay]);

  return <Circle {...props} r={radius} color={animatedColor} />;
};

export default BlurCircle;
