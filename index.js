const core = require('@actions/core');
const github = require('@actions/github');
const dotProp = require('dot-prop');
const fs = require('fs-extra');
const semver = require('semver');

(async () => {
    try {
        const {
            draft: releaseIsDraft,
            prerelease: releaseIsPrerelease,
            tag_name: releaseVersion,
        } = github.context.payload.release;
        const releaseVersionWithoutV = releaseVersion.substring(1);
        const packageJsonPath = core.getInput('package-path');
        const packageJson = await fs.readJson(packageJsonPath);
        const packageJsonVersion = dotProp.get(packageJson, 'version', undefined);

        if (releaseIsDraft) {
            core.setFailed('Release is a draft. Skip publish.');

            return;
        }

        if (!releaseVersion.startsWith('v')) {
            core.setFailed('Release tag does not start with `v`, ie. `v1.2.3`.');

            return;
        }

        if (releaseVersionWithoutV !== packageJsonVersion) {
            core.setFailed(`
                Release version does not match package.json version.
                Release version: ${releaseVersionWithoutV}
                Package.json version: ${packageJsonVersion}
            `);

            return;
        }

        if (!semver.valid(releaseVersionWithoutV)) {
            core.setFailed(`Release and package.json versions are not valid semver.`);

            return;
        }

        const semverPrerelease = semver.prerelease(releaseVersionWithoutV);
        let tag = '';

        if (releaseIsPrerelease && semverPrerelease === null) {
            core.setFailed(
                'Release in GitHub is marked as `pre-release`, but release tag and package.json versions do not follow pre-release format, ie. `1.2.3-beta.1'
            );

            return;
        }

        if (!releaseIsPrerelease && semverPrerelease !== null) {
            core.setFailed(
                'Release tag and package.json versions follow pre-release format, ie. `1.2.3-beta.1, but release in GitHub is not marked as `pre-release`.'
            );

            return;
        }

        if (releaseIsPrerelease && semverPrerelease !== null) {
            tag += semverPrerelease[0];
        }

        core.setOutput('version', releaseVersionWithoutV);
        core.setOutput('tag', tag);
    } catch (error) {
        core.setFailed(error.message);
    }
})();
