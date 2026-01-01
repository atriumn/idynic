import * as SecureStore from 'expo-secure-store';
import { mobileStorageAdapter } from '../../lib/storage-adapter';

describe('mobileStorageAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getItem', () => {
    it('returns value from SecureStore when it exists', async () => {
      const testValue = JSON.stringify({ test: 'value' });
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(testValue);

      const result = await mobileStorageAdapter.getItem('test-key');

      expect(SecureStore.getItemAsync).toHaveBeenCalledWith('test-key');
      expect(result).toBe(testValue);
    });

    it('returns null when value does not exist', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await mobileStorageAdapter.getItem('nonexistent-key');

      expect(result).toBeNull();
    });

    it('returns null and logs error when SecureStore throws', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('SecureStore error');
      (SecureStore.getItemAsync as jest.Mock).mockRejectedValue(error);

      const result = await mobileStorageAdapter.getItem('test-key');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('SecureStore getItem error:', error);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('setItem', () => {
    it('stores value in SecureStore', async () => {
      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
      const testValue = JSON.stringify({ test: 'data' });

      await mobileStorageAdapter.setItem('test-key', testValue);

      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('test-key', testValue);
    });

    it('logs error when SecureStore throws', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('SecureStore write error');
      (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(error);

      await mobileStorageAdapter.setItem('test-key', 'value');

      expect(consoleErrorSpy).toHaveBeenCalledWith('SecureStore setItem error:', error);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('integration', () => {
    it('can store and retrieve onboarding state', async () => {
      const onboardingState = {
        dismissed: { after_resume_upload: true },
        updatedAt: new Date().toISOString(),
      };
      const serialized = JSON.stringify(onboardingState);

      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(serialized);

      await mobileStorageAdapter.setItem('idynic_onboarding', serialized);
      const result = await mobileStorageAdapter.getItem('idynic_onboarding');

      expect(result).toBe(serialized);
      expect(JSON.parse(result!)).toEqual(onboardingState);
    });
  });
});
