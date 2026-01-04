import React from "react";
import { View, useWindowDimensions, StyleSheet } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useColorScheme } from "nativewind";

export function MeshBackground() {
  const { width, height } = useWindowDimensions();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Adjust opacity based on theme if needed, though usually dark mode needs subtle glow
  const opacity = isDark ? 0.2 : 0.3;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* We don't set a solid bg color here so the system theme bg shows through if needed, 
           but usually this component is placed behind everything. */}
      <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="tealGradient" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor="#14b8a6" stopOpacity={opacity} />
            <Stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id="indigoGradient"
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
          >
            <Stop offset="0%" stopColor="#6366f1" stopOpacity={opacity} />
            <Stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id="primaryGradient"
            cx="50%"
            cy="50%"
            rx="50%"
            ry="50%"
          >
            <Stop offset="0%" stopColor="#14b8a6" stopOpacity={opacity * 0.5} />
            <Stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {/* Top Right Blob - positioned relative to screen size */}
        <Circle cx={width} cy={0} r={width * 0.8} fill="url(#tealGradient)" />

        {/* Bottom Left Blob */}
        <Circle
          cx={0}
          cy={height}
          r={width * 0.9}
          fill="url(#indigoGradient)"
        />

        {/* Center Blob */}
        <Circle
          cx={width * 0.5}
          cy={height * 0.5}
          r={width}
          fill="url(#primaryGradient)"
        />
      </Svg>
    </View>
  );
}
