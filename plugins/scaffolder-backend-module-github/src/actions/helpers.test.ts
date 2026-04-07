/*
 * Copyright 2023 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ConfigReader } from '@backstage/config';
import {
  createGithubRepoWithCollaboratorsAndTopics,
  getGitCommitMessage,
} from './helpers';
import { mockServices } from '@backstage/backend-test-utils';

describe('getGitCommitMessage', () => {
  it('should return gitCommitMessage when provided', () => {
    const mockConfig = new ConfigReader({});
    const gitCommitMessage = 'Custom commit message';

    const result = getGitCommitMessage(gitCommitMessage, mockConfig);

    expect(result).toEqual('Custom commit message');
  });

  it('should return default commit message from config when gitCommitMessage is undefined', () => {
    const mockConfig = new ConfigReader({
      scaffolder: {
        defaultCommitMessage: 'Default commit message',
      },
    });
    const result = getGitCommitMessage(undefined, mockConfig);

    expect(result).toEqual('Default commit message');
  });

  it('should return undefined when both gitCommitMessage and default commit message are undefined', () => {
    const mockConfig = new ConfigReader({});
    const result = getGitCommitMessage(undefined, mockConfig);

    expect(result).toBeUndefined();
  });
});

describe('createGithubRepoWithCollaboratorsAndTopics', () => {
  const mockLogger = mockServices.logger.mock();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureRepoExists', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should poll the GitHub API when ensureRepoExists is true', async () => {
      const mockGetByUsername = jest.fn().mockResolvedValue({
        data: { type: 'Organization' },
      });
      const mockCreateInOrg = jest.fn().mockResolvedValue({
        data: {
          name: 'test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
          html_url: 'https://github.com/test-org/test-repo',
        },
      });
      // First call returns 404, second call succeeds
      const mockGet = jest
        .fn()
        .mockRejectedValueOnce(new Error('Not Found'))
        .mockResolvedValueOnce({
          data: { name: 'test-repo' },
        });

      const mockOctokit = {
        rest: {
          users: {
            getByUsername: mockGetByUsername,
          },
          repos: {
            createInOrg: mockCreateInOrg,
            get: mockGet,
          },
        },
      } as any;

      const promise = createGithubRepoWithCollaboratorsAndTopics(
        mockOctokit,
        'test-repo',
        'test-org',
        'private',
        'Test description',
        undefined,
        false,
        true,
        true,
        'COMMIT_OR_PR_TITLE',
        'COMMIT_MESSAGES',
        true,
        false,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        mockLogger,
        undefined,
        undefined,
        true, // ensureRepoExists
      );

      // Advance timers to allow the retry
      await jest.advanceTimersByTimeAsync(1000);

      await promise;

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockGet).toHaveBeenCalledWith({
        owner: 'test-org',
        repo: 'test-repo',
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Polling GitHub API to ensure repository test-org/test-repo exists...',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Repository test-org/test-repo confirmed to exist after 2 attempt(s)',
      );
    });

    it('should succeed immediately if repo exists on first check', async () => {
      const mockGetByUsername = jest.fn().mockResolvedValue({
        data: { type: 'Organization' },
      });
      const mockCreateInOrg = jest.fn().mockResolvedValue({
        data: {
          name: 'test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
          html_url: 'https://github.com/test-org/test-repo',
        },
      });
      const mockGet = jest.fn().mockResolvedValue({
        data: { name: 'test-repo' },
      });

      const mockOctokit = {
        rest: {
          users: {
            getByUsername: mockGetByUsername,
          },
          repos: {
            createInOrg: mockCreateInOrg,
            get: mockGet,
          },
        },
      } as any;

      await createGithubRepoWithCollaboratorsAndTopics(
        mockOctokit,
        'test-repo',
        'test-org',
        'private',
        'Test description',
        undefined,
        false,
        true,
        true,
        'COMMIT_OR_PR_TITLE',
        'COMMIT_MESSAGES',
        true,
        false,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        mockLogger,
        undefined,
        undefined,
        true, // ensureRepoExists
      );

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Repository test-org/test-repo confirmed to exist after 1 attempt(s)',
      );
    });

    it('should throw error after max attempts exceeded', async () => {
      const mockGetByUsername = jest.fn().mockResolvedValue({
        data: { type: 'Organization' },
      });
      const mockCreateInOrg = jest.fn().mockResolvedValue({
        data: {
          name: 'test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
          html_url: 'https://github.com/test-org/test-repo',
        },
      });
      // Always return 404
      const mockGet = jest.fn().mockRejectedValue(new Error('Not Found'));

      const mockOctokit = {
        rest: {
          users: {
            getByUsername: mockGetByUsername,
          },
          repos: {
            createInOrg: mockCreateInOrg,
            get: mockGet,
          },
        },
      } as any;

      let error: Error | undefined;
      const promise = createGithubRepoWithCollaboratorsAndTopics(
        mockOctokit,
        'test-repo',
        'test-org',
        'private',
        'Test description',
        undefined,
        false,
        true,
        true,
        'COMMIT_OR_PR_TITLE',
        'COMMIT_MESSAGES',
        true,
        false,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        mockLogger,
        undefined,
        undefined,
        true, // ensureRepoExists
      ).catch(e => {
        error = e;
      });

      // Advance timers to allow all retries
      for (let i = 0; i < 10; i++) {
        await jest.advanceTimersByTimeAsync(1000);
      }

      await promise;

      expect(error).toBeDefined();
      expect(error?.message).toContain(
        'Repository test-org/test-repo still not accessible after 10 attempts',
      );
      expect(mockGet).toHaveBeenCalledTimes(10);
    });

    it('should not poll when ensureRepoExists is false', async () => {
      const mockGetByUsername = jest.fn().mockResolvedValue({
        data: { type: 'Organization' },
      });
      const mockCreateInOrg = jest.fn().mockResolvedValue({
        data: {
          name: 'test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
          html_url: 'https://github.com/test-org/test-repo',
        },
      });
      const mockGet = jest.fn();

      const mockOctokit = {
        rest: {
          users: {
            getByUsername: mockGetByUsername,
          },
          repos: {
            createInOrg: mockCreateInOrg,
            get: mockGet,
          },
        },
      } as any;

      await createGithubRepoWithCollaboratorsAndTopics(
        mockOctokit,
        'test-repo',
        'test-org',
        'private',
        'Test description',
        undefined,
        false,
        true,
        true,
        'COMMIT_OR_PR_TITLE',
        'COMMIT_MESSAGES',
        true,
        false,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        mockLogger,
        undefined,
        undefined,
        false, // ensureRepoExists
      );

      expect(mockGet).not.toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Polling GitHub API'),
      );
    });

    it('should not poll when ensureRepoExists is undefined', async () => {
      const mockGetByUsername = jest.fn().mockResolvedValue({
        data: { type: 'Organization' },
      });
      const mockCreateInOrg = jest.fn().mockResolvedValue({
        data: {
          name: 'test-repo',
          clone_url: 'https://github.com/test-org/test-repo.git',
          html_url: 'https://github.com/test-org/test-repo',
        },
      });
      const mockGet = jest.fn();

      const mockOctokit = {
        rest: {
          users: {
            getByUsername: mockGetByUsername,
          },
          repos: {
            createInOrg: mockCreateInOrg,
            get: mockGet,
          },
        },
      } as any;

      await createGithubRepoWithCollaboratorsAndTopics(
        mockOctokit,
        'test-repo',
        'test-org',
        'private',
        'Test description',
        undefined,
        false,
        true,
        true,
        'COMMIT_OR_PR_TITLE',
        'COMMIT_MESSAGES',
        true,
        false,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        mockLogger,
        undefined,
        undefined,
        undefined, // ensureRepoExists
      );

      expect(mockGet).not.toHaveBeenCalled();
    });
  });
});
