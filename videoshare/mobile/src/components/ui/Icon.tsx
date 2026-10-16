import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

/**
 * Monochrome icon set.
 *
 * Every icon inherits a single `color`, so they always match the active theme.
 * The shapes are drawn with plain `View`s wherever a reliable glyph does not
 * exist, which avoids two classic Android problems: pictographic characters
 * being substituted by a colour emoji font, and geometric characters missing
 * from the device font entirely. The handful of glyphs still used are ASCII or
 * Basic-Latin symbols that ship with every system font (arrows and ×/+).
 */

export type IconName =
  | 'back'
  | 'chevronRight'
  | 'chevronDown'
  | 'arrowRight'
  | 'check'
  | 'close'
  | 'plus'
  | 'send'
  | 'download'
  | 'upload'
  | 'play'
  | 'pause'
  | 'lock'
  | 'signal'
  | 'palette'
  | 'film'
  | 'clock'
  | 'alert'
  | 'sparkle'
  | 'refresh'
  | 'database';

/** Basic-Latin glyphs only: present in Roboto and in every fallback font. */
const GLYPHS: Partial<Record<IconName, string>> = {
  arrowRight: '\u2192',
  close: '\u00D7',
  plus: '\u002B',
  send: '\u2191',
  download: '\u2193',
  upload: '\u2191',
};

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  /** Stroke weight for the view-drawn shapes. */
  weight?: number;
  style?: StyleProp<ViewStyle>;
}

export const Icon: React.FC<IconProps> = ({ name, size = 20, color, weight, style }) => {
  const glyph = GLYPHS[name];
  if (glyph) {
    return (
      <Text
        allowFontScaling={false}
        style={[
          styles.glyph,
          { color, fontSize: size, lineHeight: size * 1.06 },
          style as StyleProp<TextStyle>,
        ]}
      >
        {glyph}
      </Text>
    );
  }

  const stroke = weight ?? Math.max(1.6, size * 0.1);
  const box: ViewStyle = { width: size, height: size };

  /** Chevron built from two borders on a rotated square. */
  const chevron = (rotate: string) => (
    <View style={[styles.center, box, style]}>
      <View
        style={{
          width: size * 0.46,
          height: size * 0.46,
          borderTopWidth: stroke,
          borderRightWidth: stroke,
          borderColor: color,
          transform: [{ rotate }],
        }}
      />
    </View>
  );

  switch (name) {
    case 'back':
      return chevron('-135deg');
    case 'chevronRight':
      return chevron('45deg');
    case 'chevronDown':
      return chevron('135deg');

    case 'check': {
      return (
        <View style={[styles.center, box, style]}>
          <View
            style={{
              width: size * 0.5,
              height: size * 0.26,
              borderLeftWidth: stroke,
              borderBottomWidth: stroke,
              borderColor: color,
              transform: [{ rotate: '-45deg' }],
              marginTop: -size * 0.08,
            }}
          />
        </View>
      );
    }

    case 'play': {
      return (
        <View style={[styles.center, box, style]}>
          <View
            style={{
              marginLeft: size * 0.1,
              borderTopWidth: size * 0.28,
              borderBottomWidth: size * 0.28,
              borderLeftWidth: size * 0.46,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderLeftColor: color,
            }}
          />
        </View>
      );
    }

    case 'pause': {
      return (
        <View style={[styles.row, box, style]}>
          <View
            style={{
              width: size * 0.2,
              height: size * 0.62,
              borderRadius: size * 0.06,
              backgroundColor: color,
              marginRight: size * 0.16,
            }}
          />
          <View
            style={{
              width: size * 0.2,
              height: size * 0.62,
              borderRadius: size * 0.06,
              backgroundColor: color,
            }}
          />
        </View>
      );
    }

    case 'lock': {
      return (
        <View style={[styles.center, box, style]}>
          <View
            style={{
              width: size * 0.44,
              height: size * 0.3,
              borderTopLeftRadius: size * 0.3,
              borderTopRightRadius: size * 0.3,
              borderWidth: stroke,
              borderBottomWidth: 0,
              borderColor: color,
              marginBottom: -stroke,
            }}
          />
          <View
            style={{
              width: size * 0.7,
              height: size * 0.5,
              borderRadius: size * 0.12,
              backgroundColor: color,
            }}
          />
        </View>
      );
    }

    case 'signal': {
      const heights = [0.34, 0.56, 0.78, 1];
      return (
        <View style={[styles.rowEnd, box, style]}>
          {heights.map((h, i) => (
            <View
              key={i}
              style={{
                width: size * 0.16,
                height: size * h,
                borderRadius: size * 0.05,
                backgroundColor: color,
                opacity: i === heights.length - 1 ? 1 : 0.45 + i * 0.15,
                marginLeft: i === 0 ? 0 : size * 0.09,
              }}
            />
          ))}
        </View>
      );
    }

    case 'palette': {
      // Half-filled circle: the standard light/dark appearance control.
      const d = size * 0.88;
      return (
        <View style={[styles.center, box, style]}>
          <View
            style={{
              width: d,
              height: d,
              borderRadius: d / 2,
              borderWidth: stroke,
              borderColor: color,
              overflow: 'hidden',
              flexDirection: 'row',
            }}
          >
            <View style={{ width: d / 2, height: d, backgroundColor: color }} />
          </View>
        </View>
      );
    }

    case 'film': {
      // A framed play triangle: unmistakably "video file" even at 18 px, where
      // sprocket-hole detail would disappear entirely.
      const frameW = size * 0.84;
      const frameH = size * 0.62;
      return (
        <View style={[styles.center, box, style]}>
          <View
            style={{
              width: frameW,
              height: frameH,
              borderRadius: size * 0.16,
              borderWidth: stroke,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                marginLeft: size * 0.06,
                borderTopWidth: size * 0.16,
                borderBottomWidth: size * 0.16,
                borderLeftWidth: size * 0.26,
                borderTopColor: 'transparent',
                borderBottomColor: 'transparent',
                borderLeftColor: color,
              }}
            />
          </View>
        </View>
      );
    }

    case 'clock': {
      const d = size * 0.84;
      const inner = d - stroke * 2;
      const hand = (vertical: boolean) =>
        vertical
          ? {
              position: 'absolute' as const,
              left: (inner - stroke) / 2,
              top: inner * 0.2,
              width: stroke,
              height: inner * 0.3,
              borderRadius: stroke,
              backgroundColor: color,
            }
          : {
              position: 'absolute' as const,
              top: (inner - stroke) / 2,
              left: inner * 0.5,
              width: inner * 0.26,
              height: stroke,
              borderRadius: stroke,
              backgroundColor: color,
            };
      return (
        <View style={[styles.center, box, style]}>
          <View
            style={{
              width: d,
              height: d,
              borderRadius: d / 2,
              borderWidth: stroke,
              borderColor: color,
            }}
          >
            <View style={hand(true)} />
            <View style={hand(false)} />
          </View>
        </View>
      );
    }

    case 'alert': {
      const d = size * 0.86;
      return (
        <View style={[styles.center, box, style]}>
          <View
            style={{
              width: d,
              height: d,
              borderRadius: d / 2,
              borderWidth: stroke,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: stroke,
                height: d * 0.24,
                borderRadius: stroke,
                backgroundColor: color,
                marginBottom: stroke * 1.6,
              }}
            />
            <View
              style={{
                width: stroke,
                height: stroke,
                borderRadius: stroke / 2,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      );
    }

    case 'sparkle': {
      const s = size * 0.42;
      const offset = (size - s) / 2;
      return (
        <View style={[styles.center, box, style]}>
          <View
            style={{
              position: 'absolute',
              top: offset,
              left: offset,
              width: s,
              height: s,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: offset,
              left: offset,
              width: s,
              height: s,
              backgroundColor: color,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      );
    }

    case 'refresh': {
      return (
        <View style={[styles.center, box, style]}>
          <View
            style={{
              width: size * 0.82,
              height: size * 0.82,
              borderRadius: size * 0.41,
              borderWidth: stroke,
              borderColor: color,
              borderRightColor: 'transparent',
              transform: [{ rotate: '-35deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: size * 0.02,
              top: size * 0.08,
              width: 0,
              height: 0,
              borderTopWidth: size * 0.13,
              borderBottomWidth: size * 0.13,
              borderRightWidth: size * 0.2,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
              borderRightColor: color,
            }}
          />
        </View>
      );
    }

    case 'database': {
      return (
        <View style={[styles.center, box, style]}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                top: size * (0.12 + i * 0.26),
                width: size * 0.72,
                height: size * 0.3,
                borderRadius: size * 0.15,
                borderWidth: stroke,
                borderColor: color,
              }}
            />
          ))}
        </View>
      );
    }

    default:
      return <View style={box} />;
  }
};

const styles = StyleSheet.create({
  glyph: {
    includeFontPadding: false,
    textAlign: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowEnd: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
