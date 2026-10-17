module.exports = {
    hooks: {
        readPackage(pkg) {
            // The docs' Vite alias supplies Carbon replacements for Fumadocs UI.
            // Core's optional Lucide loader is unused; content uses our registry.
            if (pkg.version === '16.17.1' && (pkg.name === '@fumadocs/base-ui' || pkg.name === 'fumadocs-core')) {
                if (pkg.dependencies) delete pkg.dependencies['lucide-react'];
                if (pkg.peerDependencies) delete pkg.peerDependencies['lucide-react'];
                if (pkg.peerDependenciesMeta) delete pkg.peerDependenciesMeta['lucide-react'];
            }
            return pkg;
        },
    },
};
