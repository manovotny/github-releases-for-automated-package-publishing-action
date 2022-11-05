const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs-extra');
const dedent = require('dedent');

const action = require('.');

jest.mock('fs-extra');
jest.mock('@actions/core');
jest.mock('@actions/github');

const generateGitHubRelease = ({draft = false, gitTag = 'v1.2.3', prerelease = false}) => ({
    payload: {
        release: {
            draft,
            prerelease,
            // eslint-disable-next-line camelcase
            tag_name: gitTag,
        },
    },
});

describe('index', () => {
    test('should ignore drafts', async () => {
        jest.spyOn(core, 'setFailed');
        github.context = generateGitHubRelease({
            draft: true,
            gitTag: 'v1.2.3',
        });

        await action();

        expect(core.setFailed).toHaveBeenCalledTimes(1);
        expect(core.setFailed).toHaveBeenCalledWith('Release is a draft. Skip publish.');
    });

    test('should fail if package.json is missing version', async () => {
        jest.spyOn(core, 'setFailed');
        fs.readJSON.mockReturnValue({});
        github.context = generateGitHubRelease({});

        await action();

        expect(core.setFailed).toHaveBeenCalledTimes(1);
        expect(core.setFailed).toHaveBeenCalledWith('Package.json is missing version.');
    });

    test('should fail if release git tag does not start with a "v"', async () => {
        jest.spyOn(core, 'setFailed');
        fs.readJSON.mockReturnValue({
            version: '1.2.3',
        });
        github.context = generateGitHubRelease({
            gitTag: '1.2.3',
        });

        await action();

        expect(core.setFailed).toHaveBeenCalledTimes(1);
        expect(core.setFailed).toHaveBeenCalledWith('Release git tag does not start with `v`, ie. `v1.2.3`.');
    });

    test('should fail if release git tag and package.json version do not match', async () => {
        const packageJsonVersion = '4.5.6';
        const releaseVersion = '1.2.3';

        jest.spyOn(core, 'setFailed');
        fs.readJSON.mockReturnValue({
            version: packageJsonVersion,
        });
        github.context = generateGitHubRelease({
            gitTag: `v${releaseVersion}`,
        });

        await action();

        expect(core.setFailed).toHaveBeenCalledTimes(1);
        expect(core.setFailed).toHaveBeenCalledWith(
            dedent(`
                Release git tag does not match package.json version.
                Release git tag: ${releaseVersion}
                Package.json version: ${packageJsonVersion}
            `)
        );
    });

    test('should fail if release git tag is not valid semver', async () => {
        jest.spyOn(core, 'setFailed');
        fs.readJSON.mockReturnValue({
            version: 'a.b.c',
        });
        github.context = generateGitHubRelease({
            gitTag: 'va.b.c',
        });

        await action();

        expect(core.setFailed).toHaveBeenCalledTimes(1);
        expect(core.setFailed).toHaveBeenCalledWith('Release git tag and package.json versions are not valid semver.');
    });

    test('should fail if release is marked as prerelease but release does not have valid semver prerelease tag', async () => {
        const version = '1.2.3';

        jest.spyOn(core, 'setFailed');
        fs.readJSON.mockReturnValue({
            version,
        });
        github.context = generateGitHubRelease({
            gitTag: `v${version}`,
            prerelease: true,
        });

        await action();

        expect(core.setFailed).toHaveBeenCalledTimes(1);
        expect(core.setFailed).toHaveBeenCalledWith(
            'Release in GitHub is marked as `pre-release`, but release git tag and package.json versions do not follow pre-release format, ie. `1.2.3-beta.1'
        );
    });

    test('should fail if release is not marked as prerelease but release has semver prerelease tag', async () => {
        const version = '1.2.3-beta.1';

        jest.spyOn(core, 'setFailed');
        fs.readJSON.mockReturnValue({
            version,
        });
        github.context = generateGitHubRelease({
            gitTag: `v${version}`,
        });

        await action();

        expect(core.setFailed).toHaveBeenCalledTimes(1);
        expect(core.setFailed).toHaveBeenCalledWith(
            'Release git tag and package.json versions follow pre-release format, ie. `1.2.3-beta.1, but release in GitHub is not marked as `pre-release`.'
        );
    });

    test('should output version and no tag (aka. not prerelease)', async () => {
        const version = '1.2.3';

        jest.spyOn(core, 'setOutput');
        fs.readJSON.mockReturnValue({
            version,
        });
        github.context = generateGitHubRelease({
            gitTag: `v${version}`,
        });

        await action();

        expect(core.setOutput).toHaveBeenCalledTimes(2);
        expect(core.setOutput).toHaveBeenCalledWith('version', version);
        expect(core.setOutput).toHaveBeenCalledWith('tag', '');
    });

    test('should output version and tag (aka. prerelease)', async () => {
        const tag = 'beta';
        const version = `1.2.3-${tag}.1`;

        jest.spyOn(core, 'setOutput');
        fs.readJSON.mockReturnValue({
            version,
        });
        github.context = generateGitHubRelease({
            gitTag: `v${version}`,
            prerelease: true,
        });

        await action();

        expect(core.setOutput).toHaveBeenCalledTimes(2);
        expect(core.setOutput).toHaveBeenCalledWith('version', version);
        expect(core.setOutput).toHaveBeenCalledWith('tag', tag);
    });
});
