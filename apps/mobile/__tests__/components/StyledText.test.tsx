import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MonoText } from '../../components/StyledText';

// Mock useColorScheme
jest.mock('../../components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('MonoText', () => {
  it('renders text content', () => {
    render(<MonoText>Hello World</MonoText>);

    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('applies SpaceMono font family', () => {
    render(<MonoText testID="mono-text">Code text</MonoText>);

    const textElement = screen.getByTestId('mono-text');
    // Style is flattened and may contain nested arrays
    const flatStyle = JSON.stringify(textElement.props.style);
    expect(flatStyle).toContain('SpaceMono');
  });

  it('preserves additional style props', () => {
    render(
      <MonoText testID="styled-mono" style={{ fontSize: 20 }}>
        Styled text
      </MonoText>
    );

    const textElement = screen.getByTestId('styled-mono');
    const flatStyle = JSON.stringify(textElement.props.style);
    expect(flatStyle).toContain('SpaceMono');
    expect(flatStyle).toContain('20'); // fontSize: 20
  });
});
