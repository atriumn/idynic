import { useColorScheme } from '../../components/useColorScheme';

describe('useColorScheme', () => {
  it('exports useColorScheme function', () => {
    expect(useColorScheme).toBeDefined();
    expect(typeof useColorScheme).toBe('function');
  });
});
