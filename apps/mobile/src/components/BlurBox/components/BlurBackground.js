import BlurCircle from "./BlurCircle/BlurCircle";
import styles from "./styles";
import { SIZES } from "../constants";
import { Blur, Canvas, Group } from "@shopify/react-native-skia";
import React, { useRef } from "react";

const BlurBackground = () => {
  /** Radius of circle */
  const r = useRef(SIZES.WINDOW.WIDTH / 2.5).current;
  /** An array responsible for how many circles will be located on the screen */
  const circles = useRef(new Array(6).fill(1)).current;
  /** The distance the elements will be located from each other */
  const step = SIZES.WINDOW.HEIGHT / circles.length;

  return (
    <Canvas style={styles.background}>
      <Group>
        <Blur blur={50} />
        {circles.map((_, index) => (
          <BlurCircle
            key={index}
            // Arrange elements in a checkerboard pattern
            cx={index % 2 ? SIZES.WINDOW.WIDTH : 0}
            cy={step * index}
            r={r}
            delay={index * 1000}
          />
        ))}
      </Group>
    </Canvas>
  );
};

export default BlurBackground;
