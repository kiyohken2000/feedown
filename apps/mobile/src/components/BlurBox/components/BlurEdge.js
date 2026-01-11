import { SIZES } from "../constants";
import {
  Canvas,
  LinearGradient,
  Rect,
} from "@shopify/react-native-skia";
import React from "react";

const BlurEdge = ({
  enabled = true,
  height,
  style,
  ...props
}) => {
  if (!enabled) {
    return null;
  }
  return (
    <Canvas style={[style, { height }]}>
      <Rect x={0} y={0} width={SIZES.WINDOW.WIDTH} height={height}>
        <LinearGradient
          start={props.start}
          end={props.end}
          colors={props.colors}
        />
      </Rect>
    </Canvas>
  );
};

export default BlurEdge;
