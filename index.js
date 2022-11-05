const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs-extra');
const semver = require('semver');
const dedent = require('dedent');

const main = async () => {
    try {
        const {draft: isDraft, prerelease: isPrerelease, tag_name: gitTag} = github.context.payload.release;
        const gitTagWithoutV = gitTag.slice(1);
        const packageJson = await fs.readJson('./package.json');
        const packageJsonVersion = packageJson?.version || undefined;

        if (isDraft) {
            core.setFailed('Release is a draft. Skip publish.');

            return;
        }

        if (!packageJsonVersion) {
            core.setFailed('Package.json is missing version.');

            return;
        }

        if (!gitTag.startsWith('v')) {
            core.setFailed('Release git tag does not start with `v`, ie. `v1.2.3`.');

            return;
        }

        if (gitTagWithoutV !== packageJsonVersion) {
            core.setFailed(
                dedent(`
                    Release git tag does not match package.json version.
                    Release git tag: ${gitTagWithoutV}
                    Package.json version: ${packageJsonVersion}
                `)
            );

            return;
        }

        if (!semver.valid(gitTagWithoutV)) {
            core.setFailed('Release git tag and package.json versions are not valid semver.');

            return;
        }

        const semverPrerelease = semver.prerelease(gitTagWithoutV);
        // eslint-disable-next-line unicorn/no-null
        const hasSemverPrerelease = semverPrerelease !== null;

        let versionTag = '';

        if (isPrerelease && !hasSemverPrerelease) {
            core.setFailed(
                'Release in GitHub is marked as `pre-release`, but release git tag and package.json versions do not follow pre-release format, ie. `1.2.3-beta.1'
            );

            return;
        }

        if (!isPrerelease && hasSemverPrerelease) {
            core.setFailed(
                'Release git tag and package.json versions follow pre-release format, ie. `1.2.3-beta.1, but release in GitHub is not marked as `pre-release`.'
            );

            return;
        }

        if (isPrerelease && hasSemverPrerelease) {
            versionTag += semverPrerelease[0];
        }

        core.setOutput('version', gitTagWithoutV);
        core.setOutput('tag', versionTag);
    } catch (error) {
        core.setFailed(error.message);
    }
};

if (require.main === module) {
    main();
} else {
    module.exports = main;
}
